"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Next.js dynamic import requires a Promise that resolves to an object with a 'default' property.
const Joyride = dynamic(
  () => import("react-joyride").then((mod: any) => ({ default: mod.default || mod.Joyride || mod })),
  { ssr: false }
) as any;

export function ProductTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the tour
    const isCompleted = localStorage.getItem("tourCompleted");
    if (!isCompleted) {
      // Small delay to ensure the DOM is fully painted so targets exist
      const timer = setTimeout(() => setRun(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    if (["finished", "skipped"].includes(status)) {
      localStorage.setItem("tourCompleted", "true");
      setRun(false);
    }
  };

  const steps = [
    {
      target: "#tour-explorer",
      content: "This is the Explorer where you can manage your smart contract files and navigate your project.",
      disableBeacon: true,
    },
    {
      target: "#tour-monaco",
      content: "Write and edit your Rust smart contracts here in the Monaco editor, complete with syntax highlighting and autocompletion.",
    },
    {
      target: "#tour-build-btn",
      content: "Click this Build button to compile your smart contract into WebAssembly. Fast and easy!",
    },
    {
      target: "#tour-deploy-sidebar",
      content: "Deploy your built contracts or view recent deployments directly from this sidebar.",
    },
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#EAB308",
          textColor: "#f8fafc",
          backgroundColor: "#0B0D13",
          arrowColor: "#0B0D13",
          overlayColor: "rgba(0, 0, 0, 0.75)",
          zIndex: 10000,
        },
      }}
    />
  );
}
