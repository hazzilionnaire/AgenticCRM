import { redirect } from "next/navigation";

/** The board moved to Home. Kept so existing links and bookmarks still land. */
export default function PipelinePage() {
  redirect("/home");
}
