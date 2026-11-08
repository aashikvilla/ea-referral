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
  | "unavailable";

const characterState: Record<GuideMood, GuideCharacterState> = {
  idle: "idle",
  welcome: "welcome",
  thinking: "thinking",
  checking: "checking",
  pointing: "pointing",
  reassuring: "idle",
  success: "success",
  unavailable: "unavailable",
};

const moodLabel: Record<GuideMood, string> = {
  idle: "Ready when you are",
  welcome: "A clear place to start",
  thinking: "Working it out",
  checking: "One step at a time",
  pointing: "Let’s start here",
  reassuring: "You’re in control",
  success: "Request received",
  unavailable: "Let’s pause here",
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
  return (
    <aside className={`guide-card guide-card--${layout} guide-card--${mood}`}>
      <div className="guide-card__art" aria-hidden="true">
        <GuideCharacter
          state={characterState[mood]}
          className="guide-card__character"
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
