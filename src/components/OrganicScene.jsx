import { memo } from "react";
import { useMouseParallax } from "../hooks/useMouseParallax.js";

function OrganicSceneComponent() {
  const parallax = useMouseParallax();

  const slowX = parallax.x * 18;
  const slowY = parallax.y * 18;
  const midX = parallax.x * 34;
  const midY = parallax.y * 34;
  const fastX = parallax.x * 54;
  const fastY = parallax.y * 54;

  return (
    <div className="aprova-organic-scene" aria-hidden="true">
      <div className="aprova-scene-glow-layer aprova-scene-glow-layer-a">
        <div
          className="aprova-scene-glow-blob aprova-scene-glow-blob-a"
          style={{ transform: `translate(${slowX}px, ${slowY}px)` }}
        />
      </div>
      <div className="aprova-scene-glow-layer aprova-scene-glow-layer-b">
        <div
          className="aprova-scene-glow-blob aprova-scene-glow-blob-b"
          style={{ transform: `translate(${-midX}px, ${midY}px)` }}
        />
      </div>
      <div className="aprova-scene-glow-layer aprova-scene-glow-layer-c">
        <div
          className="aprova-scene-glow-blob aprova-scene-glow-blob-c"
          style={{ transform: `translate(${fastX}px, ${-fastY}px)` }}
        />
      </div>

      <div
        className="aprova-scene-layer aprova-scene-grid"
        style={{ transform: `translate(${slowX * 0.45}px, ${slowY * 0.45}px)` }}
      />

      <div className="aprova-scene-orbit-layer aprova-scene-orbit-layer-1">
        <div
          className="aprova-scene-orbit-parallax"
          style={{ transform: `translate(${midX * 0.4}px, ${midY * 0.4}px)` }}
        >
          <div className="aprova-scene-orbit-ring" />
        </div>
      </div>
      <div className="aprova-scene-orbit-layer aprova-scene-orbit-layer-2">
        <div
          className="aprova-scene-orbit-parallax"
          style={{ transform: `translate(${-midX * 0.25}px, ${midY * 0.2}px)` }}
        >
          <div className="aprova-scene-orbit-ring" />
        </div>
      </div>
      <div className="aprova-scene-orbit-layer aprova-scene-orbit-layer-3">
        <div
          className="aprova-scene-orbit-parallax"
          style={{ transform: `translate(${fastX * 0.18}px, ${-fastY * 0.18}px)` }}
        >
          <div className="aprova-scene-orbit-ring" />
        </div>
      </div>

      <div className="aprova-scene-stars">
        <span className="aprova-star aprova-star-1" />
        <span className="aprova-star aprova-star-2" />
        <span className="aprova-star aprova-star-3" />
        <span className="aprova-star aprova-star-4" />
        <span className="aprova-star aprova-star-5" />
        <span className="aprova-star aprova-star-6" />
        <span className="aprova-star aprova-star-7" />
        <span className="aprova-star aprova-star-8" />
        <span className="aprova-star aprova-star-9" />
        <span className="aprova-star aprova-star-10" />
      </div>

      <div className="aprova-scene-noise" />
    </div>
  );
}

export const OrganicScene = memo(OrganicSceneComponent);
