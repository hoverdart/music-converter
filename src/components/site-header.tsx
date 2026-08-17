import Image from "next/image";
import Link from "next/link";
import { Icon } from "./icon";

export function SiteHeader({ page }: { page: "studio" | "about" }) {
  const onAboutPage = page === "about";

  return (
    <header className="app-header">
      <Link className="brand" href="/" aria-label="MusicMixer home">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        MusicMixer
      </Link>
      <div className="header-actions">
        <Link className="about-pill" href={onAboutPage ? "/" : "/about"} aria-label={onAboutPage ? "Home" : "About"}>
          <Icon name={onAboutPage ? "home" : "help"} />
          <span>{onAboutPage ? "Home" : "About"}</span>
        </Link>
        <a className="creator-pill" href="https://www.shauryav.com" target="_blank" rel="noreferrer" aria-label="Created by Shaurya — visit shauryav.com">
          <Image src="/shaurya-penguin.jpg" width={32} height={32} loading="eager" alt="Shaurya's penguin icon" />
          <span><small>Created by</small><strong>Shaurya</strong></span>
          <Icon name="external" />
        </a>
      </div>
    </header>
  );
}
