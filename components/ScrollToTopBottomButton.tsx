"use client";
import { useEffect, useState } from "react";
import { FaArrowDown, FaArrowUp } from "react-icons/fa";

export default function ScrollToTopBottomButton() {
  const [atBottom, setAtBottom] = useState(false);
  const [show, setShow] = useState(true);

  useEffect(() => {
    function handleScroll() {
      const scrollY = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      setAtBottom(scrollY + windowHeight >= docHeight - 2);
    }
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Hide button if Jitsi container is present (meeting view)
    const checkJitsi = () => {
      const jitsiDiv = document.querySelector('div[data-jitsi-meeting], .jitsi-container, .jitsi-meet') || document.querySelector('iframe[src*="jitsi"]');
      setShow(!jitsiDiv);
    };
    checkJitsi();
    const observer = new MutationObserver(checkJitsi);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  function handleClick() {
    if (atBottom) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  }

  if (!show) return null;

  return (
    <button
      className="scroll-fab fancy-fab"
      onClick={handleClick}
      aria-label={atBottom ? "Scroll to top" : "Scroll to bottom"}
    >
      <span className="fab-bg-glow" />
      <span className="fab-icon">
        <span className="fab-arrow">
          {atBottom ? (
            <FaArrowUp size={32} style={{ color: '#fff', filter: 'none' }} />
          ) : (
            <FaArrowDown size={32} style={{ color: '#fff', filter: 'none' }} />
          )}
        </span>
      </span>
    </button>
  );
}
