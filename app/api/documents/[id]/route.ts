import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type DocumentRouteProps = {
  params: Promise<{ id: string }>;
};

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId: error ? null : userId };
}

export async function GET(_: Request, { params }: DocumentRouteProps) {
  const { id } = await params;
  const { supabase, userId } = await authenticatedClient();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, bucket_id, storage_path, original_name, mime_type")
    .eq("id", id)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(document.bucket_id)
    .createSignedUrl(document.storage_path, 60, {
      download: document.original_name,
    });

  if (signedUrlError) {
    return NextResponse.json(
      { error: "Unable to create a secure download link." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: data.signedUrl,
    expiresInSeconds: 60,
  });
}

export async function DELETE(_: Request, { params }: DocumentRouteProps) {
  const { id } = await params;
  const { supabase, userId } = await authenticatedClient();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, bucket_id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { error: storageError } = await supabase.storage
    .from(document.bucket_id)
    .remove([document.storage_path]);

  if (storageError) {
    return NextResponse.json({ error: "File deletion failed." }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", document.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "The file was removed but its record could not be deleted." },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
