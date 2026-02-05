/*
We want to communicate with a long-lived session, otherwise the user 
will have to reauthenticate himself multiple times over a long training session
*/
export async function createBackendSession(idToken: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to create session");
}
