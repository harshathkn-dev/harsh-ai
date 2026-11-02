type AuthMessageProps = {
  error?: string | string[];
  message?: string | string[];
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function AuthMessage({ error, message }: AuthMessageProps) {
  const errorText = first(error);
  const messageText = first(message);

  if (!errorText && !messageText) {
    return null;
  }

  return (
    <p
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        errorText
          ? "border-red-400/30 bg-red-400/10 text-red-100"
          : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      }`}
      role={errorText ? "alert" : "status"}
    >
      {errorText ?? messageText}
    </p>
  );
}
