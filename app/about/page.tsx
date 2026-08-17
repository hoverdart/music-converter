import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { PageTransition } from "@/components/page-transition";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: "The story of MusicMixer, from a 2020 Discord music bot to a private browser audio studio powered by FFmpeg and WebAssembly.",
  path: "/about"
});

export default function AboutPage() {
  return (
    <PageTransition>
      <StructuredData data={{
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "@id": `${absoluteUrl("/about")}#about`,
        url: absoluteUrl("/about"),
        name: "About MusicMixer",
        description: metadata.description,
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Studio", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "About", item: absoluteUrl("/about") }
          ]
        }
      }} />
      <SiteHeader page="about" />
      <main className="about-page" id="workspace">

      <header className="about-hero">
        <div>
          <p className="eyebrow">A project that refused to disappear</p>
          <h1>The bot grew <em>up.</em></h1>
          <p className="about-lede">MusicMixer started as a Discord bot, became a slightly chaotic Flask website, and is now a private audio studio that runs entirely in your browser. This is how a middle-school project managed to survive long enough to get a proper rewrite.</p>
        </div>
        <div className="original-mark">
          <Image src="/musicmixer-original.png" width={626} height={626} priority alt="The original MusicMixer Discord bot artwork from 2020" />
          <span>The original, circa 2020</span>
        </div>
      </header>

      <article className="about-story">
        <section className="about-chapter">
          <p className="chapter-kicker">01 · Before the mixer</p>
          <div className="chapter-copy">
            <h2><a href="https://www.shauryav.com/blog/tacobot" target="_blank" rel="noreferrer">It started with a taco.</a></h2>
            <p>Back in 2020, I made Taco Bot: a very silly Discord bot built around taco pictures, taco trivia, taco coins, and whatever other command sounded funny to a middle schooler stuck at home. Then people actually started using it. It reached more than 150 servers, created a small community, and became the first thing I built that belonged to people other than me.</p>
            <p>That was exciting. It was also terrifying. Every bug now had an audience. Every new feature produced three more ideas. I learned APIs, asynchronous Python, hosting, and the extremely important lesson that an in-memory currency will disappear when Heroku restarts. Sorry again to everyone who lost their tacos.</p>
            <p>Taco Bot taught me that the most fun projects are not necessarily the most serious ones. They are the ones that make somebody ask for one more feature.</p>
          </div>
        </section>

        <section className="about-chapter">
          <p className="chapter-kicker">02 · MusicMixer</p>
          <div className="chapter-copy">
            <h2>So, naturally, I made another bot.</h2>
            <p>MusicMixer was the successor. The original pitch was simple: a Discord music bot that could play audio from YouTube, modify it, and let you download the result. It could change pitch and speed, boost the bass, and turn a normal song into something ungodly.</p>
            <blockquote className="about-quote">Play. Mix. Download. Three words, one enormous pile of FFmpeg commands.</blockquote>
            <p>The <a href="https://sverma823.wixsite.com/mysite" target="_blank" rel="noreferrer">old website</a> promised everything with complete confidence. It had giant screenshots, a square bot avatar, and exactly the kind of vocabulary you would expect from a middle schooler building audio effects for Discord. Some details are probably better left in 2020.</p>
            <p>Underneath all of that was the same instinct Taco Bot gave me: take a tool that normally lives in a terminal, put a friendlier face on it, and let people make something weird.</p>
          </div>
        </section>

        <section className="about-chapter">
          <p className="chapter-kicker">03 · The Flask years</p>
          <div className="chapter-copy">
            <h2>Then the bot escaped Discord.</h2>
            <p>The website happened because running MusicMixer as a Discord bot became deeply annoying. It needed an always-on computer with FFmpeg, a downloader, enough storage, and constant access to a real file directory. Every request wrote media in and out of that directory. My implementation did far too much direct file rewriting, which meant a bad filename, a failed cleanup, or one careless path could become a much bigger problem than a broken Discord command.</p>
            <p>The Discord voice side became unreliable too. Getting the bot to join a channel, disconnect cleanly, and consistently play audio grew stranger over time for reasons I honestly no longer remember. Eventually I spent more time persuading the bot to enter and leave voice channels correctly than I did making the audio features fun.</p>
            <p>So the bot escaped Discord and became a Flask website. You uploaded a file, Python launched FFmpeg or yt-dlp through a subprocess, the server did the work, and you downloaded whatever came out the other side. I found PythonAnywhere and hosted it there. For a while, it actually worked.</p>
            <p>The funny part is that the useful idea was never the server. It was the workflow: give MusicMixer a piece of media, make a few understandable choices, and get the version you actually wanted.</p>
            <div className="then-now">
              <article>
                <small>Then</small>
                <strong>Upload it and hope</strong>
                <p>Flask, subprocesses, temporary folders, and server-side media.</p>
              </article>
              <article>
                <small>Now</small>
                <strong>Your device does the work</strong>
                <p>Next.js, Web Workers, local storage, and FFmpeg compiled for the browser.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="about-chapter">
          <p className="chapter-kicker">04 · Why it stopped</p>
          <div className="chapter-copy">
            <h2>YouTube kept moving the goalposts.</h2>
            <p>One of the main reasons I stopped working on MusicMixer was the downloader. I started with youtube-dl, which was already finicky: it ran into hosting problems, the API was annoying to work around, and its own documentation made it sound like parts of what I depended on would be deprecated soon. Eventually, keeping it alive felt less like maintaining a feature and more like negotiating with it.</p>
            <p>So I switched to yt-dlp. It was newer and more actively maintained. In theory, it was the answer. In practice, I still had the same problem: sometimes it simply would not download. A link would work one day, fail the next, and leave me trying to figure out whether I had broken something or YouTube had changed something again.</p>
            <blockquote className="about-quote">The website worked, right up until its most important command was no longer allowed.</blockquote>
            <p>PythonAnywhere eventually blocked the yt-dlp calls MusicMixer depended on unless I upgraded to a paid plan. The reason was understandable; letting free accounts run media downloaders is an obvious way to make a hosting service miserable. It was still the final nail in the coffin for a broke middle and high schooler. Between the downloader breaking unpredictably, the cost of proper hosting, and an architecture built around constantly writing and deleting media files, keeping MusicMixer alive stopped making sense.</p>
            <p>Then high school picked up, and MusicMixer was quietly left behind. Taco Bot lasted longer, but hosting kept getting more expensive there too. When Heroku removed its free tier, I eventually had to shut Taco Bot down as well. Neither project ended with a dramatic final message. They just became harder to keep online than a teenager with homework could reasonably justify.</p>
          </div>
        </section>

        <section className="about-chapter">
          <p className="chapter-kicker">05 · This version</p>
          <div className="chapter-copy">
            <h2>The useful part, rebuilt properly.</h2>
            <p>Today’s MusicMixer keeps the old promise without keeping the old architecture. Files stay on your device. FFmpeg runs locally in a worker. You can convert, trim, split, merge, change pitch or speed, clean up a voice recording, normalize loudness, add fades, and push the bass all the way to “Oh my god,” because some ideas deserve to survive.</p>
            <p>It is slower than native FFmpeg. Browsers have memory limits. Closing the tab still closes the workshop. But there is no upload server quietly holding your voice memo, no account to create, and no mystery copy of your media waiting in somebody else’s bucket.</p>
            <p>YouTube importing is the one piece that does not belong in the hosted site. yt-dlp needs a native runtime and downloading media comes with real permission and platform-rule questions. If it returns, it will live in an optional desktop edition, run locally, and ask you to confirm that you are allowed to download the thing you gave it.</p>
          </div>
        </section>

        <section className="about-chapter">
          <p className="chapter-kicker">06 · Looking back</p>
          <div className="chapter-copy">
            <h2>Some projects are worth keeping.</h2>
            <p>Taco Bot and MusicMixer are important relics of my past. They taught me Python, APIs, asynchronous code, deployment, FFmpeg, and more about Discord bot programming than I could have learned from any tutorial. More importantly, they taught me what happens when software leaves your laptop and becomes something other people rely on.</p>
            <p>They even earned me Discord&apos;s “Early Verified Bot Developer” badge, which a surprising number of people have since tried to buy from me. That is a very strange legacy for two bots made by a kid, but I suppose it proves that the internet remembers the weirdest parts of your résumé.</p>
            <p>They also gave me my first taste of the impact customer-facing technology can have. The “customers” were Discord users trying to play the bass-boosted Gummy Bear song or answer as many taco trivia questions as humanly possible, but the lesson was real: people notice when something works, care when it breaks, and will happily tell you what it should do next.</p>
            <p>MusicMixer is not the most important thing I have ever built. It may, however, be one of the clearest records of how I learned to build: start with a joke, add far too many features, break several things, learn why they broke, and eventually come back with better tools.</p>
            <p>Taco Bot gave me the spark. MusicMixer gave that spark a waveform and an unreasonable amount of bass.</p>
            <p><strong>I would absolutely build it again.</strong> Apparently, I just did.</p>
          </div>
        </section>
      </article>
      </main>
    </PageTransition>
  );
}
