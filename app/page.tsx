// Root URL ("/") handler. This route has no UI of its own — it immediately
// redirects visitors to the real homepage at /home. Keeping "/" separate from
// "/home" allows the (guest) route group to own the actual homepage layout.
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/home");
}
