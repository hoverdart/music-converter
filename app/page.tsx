import type { Metadata } from "next";
import { Studio } from "@/components/studio";
import { PageTransition } from "@/components/page-transition";
import { HOME_DESCRIPTION, HOME_TITLE, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/"
});

export default function Home() {
  return <PageTransition><Studio /></PageTransition>;
}
