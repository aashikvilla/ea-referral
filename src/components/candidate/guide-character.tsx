"use client";

import Image from "next/image";
import {
  useLayoutEffect,
  useRef,
  useState,
  type SyntheticEvent,
  type TransitionEvent,
} from "react";
import styles from "./guide-character.module.css";

export type GuideCharacterState =
  | "idle"
  | "welcome"
  | "thinking"
  | "checking"
  | "pointing"
  | "success"
  | "unavailable"
  | "need-info"
  | "looks-good"
  | "submitted";

const portraitForState: Record<GuideCharacterState, string> = {
  idle: "/guide/aashik-welcome.webp",
  welcome: "/guide/aashik-welcome.webp",
  thinking: "/guide/aashik-thinking.webp",
  checking: "/guide/aashik-checking.webp",
  pointing: "/guide/aashik-next-step.webp",
  success: "/guide/aashik-looks-good.webp",
  unavailable: "/guide/aashik-unavailable.webp",
  "need-info": "/guide/aashik-need-info.webp",
  "looks-good": "/guide/aashik-looks-good.webp",
  submitted: "/guide/aashik-submitted.webp",
};

type IncomingPortraitProps = {
  src: string;
  sizes: string;
  ready: boolean;
  onDecoded: (src: string) => void;
  onTransitionEnd: (
    event: TransitionEvent<HTMLImageElement>,
    src: string,
  ) => void;
};

function IncomingPortrait({
  src,
  sizes,
  ready,
  onDecoded,
  onTransitionEnd,
}: IncomingPortraitProps) {
  const isMounted = useRef(true);

  useLayoutEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const decoded =
      typeof image.decode === "function" ? image.decode() : Promise.resolve();
    void decoded
      .then(() => {
        if (isMounted.current) onDecoded(src);
      })
      .catch(() => undefined);
  }

  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      fill
      sizes={sizes}
      quality={90}
      className={`${styles.portrait} ${styles.portraitIncoming}`}
      data-ready={ready || undefined}
      onLoad={handleLoad}
      onTransitionEnd={(event) => onTransitionEnd(event, src)}
    />
  );
}

export function GuideCharacter({
  state,
  className,
  sizes = "(max-width: 640px) 80vw, 272px",
}: {
  state: GuideCharacterState;
  className?: string;
  sizes?: string;
}) {
  const targetSrc = portraitForState[state];
  const targetSrcRef = useRef(targetSrc);
  const [displayedSrc, setDisplayedSrc] = useState(targetSrc);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const incomingSrc = targetSrc === displayedSrc ? null : targetSrc;
  const incomingReady = incomingSrc !== null && readySrc === incomingSrc;

  useLayoutEffect(() => {
    targetSrcRef.current = targetSrc;
  }, [targetSrc]);

  function handleDecoded(src: string) {
    if (targetSrcRef.current !== src) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayedSrc(src);
      setReadySrc(null);
      return;
    }

    setReadySrc(src);
  }

  function handleCrossfadeEnd(
    event: TransitionEvent<HTMLImageElement>,
    src: string,
  ) {
    if (
      event.propertyName !== "opacity" ||
      targetSrcRef.current !== src ||
      readySrc !== src
    ) {
      return;
    }

    setDisplayedSrc(src);
    setReadySrc(null);
  }

  const classNames = [styles.stage, className].filter(Boolean).join(" ");

  return (
    <div className={classNames} data-state={state} aria-hidden="true">
      <Image
        src={displayedSrc}
        alt=""
        aria-hidden="true"
        fill
        sizes={sizes}
        quality={90}
        className={`${styles.portrait} ${styles.portraitCurrent}`}
      />
      {incomingSrc && (
        <IncomingPortrait
          key={incomingSrc}
          src={incomingSrc}
          sizes={sizes}
          ready={incomingReady}
          onDecoded={handleDecoded}
          onTransitionEnd={handleCrossfadeEnd}
        />
      )}
      {state === "checking" && (
        <span className={styles.checkingIndicator}>
          <span className={styles.checkingArc} />
        </span>
      )}
    </div>
  );
}
