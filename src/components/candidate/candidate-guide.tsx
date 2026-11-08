import {
  GuideCharacter,
  type GuideCharacterState,
} from "@/components/candidate/guide-character";

export type GuideMood =
  | "idle"
  | "welcome"
  | "thinking"
  | "checking"
  | "pointing"
  | "reassuring"
  | "success"
  | "unavailable"
  | "looks-good"
  | "submitted";

const characterState: Record<GuideMood, GuideCharacterState> = {
  idle: "idle",
  welcome: "welcome",
  thinking: "thinking",
  checking: "checking",
  pointing: "pointing",
  reassuring: "need-info",
  success: "looks-good",
  unavailable: "unavailable",
  "looks-good": "looks-good",
  submitted: "submitted",
};

const moodLabel: Record<GuideMood, string> = {
  idle: "Ready when you are",
  welcome: "A clear place to start",
  thinking: "Working it out",
  checking: "Checking the details",
  pointing: "Let’s start here",
  reassuring: "You’re in control",
  success: "Looks good",
  unavailable: "Let’s pause here",
  "looks-good": "Looks good",
  submitted: "Request received",
};

export function CandidateGuide({
  mood,
  title,
  message,
  layout = "stacked",
  headingLevel = "h2",
}: {
  mood: GuideMood;
  title: string;
  message: string;
  layout?: "stacked" | "compact" | "hero";
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  const imageSizes =
    layout === "compact"
      ? "112px"
      : layout === "hero"
        ? "(max-width: 640px) 80vw, 272px"
        : "192px";
  return (
    <aside className={`guide-card guide-card--${layout} guide-card--${mood}`}>
      <div className="guide-card__art" aria-hidden="true">
        <GuideCharacter
          state={characterState[mood]}
          className="guide-card__character"
          sizes={imageSizes}
        />
      </div>
      <div className="guide-card__copy">
        <p className="guide-card__eyebrow">
          Aashik <span aria-hidden="true">·</span> here to help
        </p>
        <p className="guide-card__label">{moodLabel[mood]}</p>
        <Heading className="guide-card__title">{title}</Heading>
        <p className="guide-card__message">{message}</p>
      </div>
    </aside>
  );
}
