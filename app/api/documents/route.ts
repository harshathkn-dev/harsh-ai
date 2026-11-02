import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_BUCKETS = new Set([
  "user-documents",
  "resumes",
  "session-attachments",
]);
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function cleanFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId: error ? null : userId };
}

export async function GET() {
  const { supabase, userId } = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, bucket_id, original_name, mime_type, size_bytes, status, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load documents." }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

export async function POST(request: Request) {
  const { supabase, userId } = await authenticatedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const requestedBucket = String(
    formData.get("bucket") ?? "user-documents",
  );

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  if (!ALLOWED_BUCKETS.has(requestedBucket)) {
    return NextResponse.json({ error: "Invalid storage destination." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Files must be between 1 byte and 10 MB." },
      { status: 413 },
    );
  }

  const fileName = cleanFileName(file.name) || "upload";
  const storagePath = `${userId}/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(requestedBucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      bucket_id: requestedBucket,
      storage_path: storagePath,
      original_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select(
      "id, bucket_id, original_name, mime_type, size_bytes, status, created_at",
    )
    .single();

  if (insertError) {
    await supabase.storage.from(requestedBucket).remove([storagePath]);
    return NextResponse.json(
      { error: "The file uploaded but its record could not be created." },
      { status: 500 },
    );
  }

  return NextResponse.json({ document }, { status: 201 });
}
