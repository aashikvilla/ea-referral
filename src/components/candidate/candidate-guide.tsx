import Image from "next/image";

export type GuideMood =
  "welcome" | "checking" | "reassuring" | "success" | "unavailable";

const artwork: Record<GuideMood, string> = {
  welcome: "/guide/guide-welcome.webp",
  checking: "/guide/guide-checking.webp",
  reassuring: "/guide/guide-welcome.webp",
  success: "/guide/guide-success.webp",
  unavailable: "/guide/guide-unavailable.webp",
};

const moodLabel: Record<GuideMood, string> = {
  welcome: "A clear place to start",
  checking: "One step at a time",
  reassuring: "You’re in control",
  success: "Request preview complete",
  unavailable: "Let’s pause here",
};

export function CandidateGuide({
  mood,
  title,
  message,
  layout = "stacked",
}: {
  mood: GuideMood;
  title: string;
  message: string;
  layout?: "stacked" | "compact" | "hero";
}) {
  return (
    <aside
      className={`guide-card guide-card--${layout} guide-card--${mood}`}
      aria-label={`Pip, your process guide: ${title}`}
    >
      <div className="guide-card__art" aria-hidden="true">
        <span className="guide-card__orbit guide-card__orbit--one" />
        <span className="guide-card__orbit guide-card__orbit--two" />
        <Image
          src={artwork[mood]}
          alt=""
          width={768}
          height={960}
          priority={layout === "hero"}
          className="guide-card__image"
        />
      </div>
      <div className="guide-card__copy">
        <p className="guide-card__eyebrow">
          Pip <span aria-hidden="true">·</span> your process guide
        </p>
        <p className="guide-card__label">{moodLabel[mood]}</p>
        <h2 className="guide-card__title">{title}</h2>
        <p className="guide-card__message">{message}</p>
      </div>
    </aside>
  );
}
