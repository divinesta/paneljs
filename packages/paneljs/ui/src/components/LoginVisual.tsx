import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import visualOne from "../assets/login-visual-1.jpg";
import visualTwo from "../assets/login-visual-2.jpg";
import visualThree from "../assets/login-visual-3.jpg";
import generatedVisual from "../assets/login-architecture.png";
import panelLogo from "../assets/paneljs-logo-dark.svg";

const images = [visualOne, visualTwo, visualThree, generatedVisual];
const intervalMs = 5_000;

export const LoginVisual = () => {
   const [active, setActive] = useState(0);
   const [paused, setPaused] = useState(false);
   const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const [visible, setVisible] = useState(() => !document.hidden);
   const [loaded, setLoaded] = useState<boolean[]>(images.map(() => false));

   useEffect(() => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onMotionChange = () => setReducedMotion(media.matches);
      const onVisibilityChange = () => setVisible(!document.hidden);
      media.addEventListener("change", onMotionChange);
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
         media.removeEventListener("change", onMotionChange);
         document.removeEventListener("visibilitychange", onVisibilityChange);
      };
   }, []);

   useEffect(() => {
      if (paused || reducedMotion || !visible) return;
      const timer = window.setInterval(() => {
         setActive((current) => {
            for (let offset = 1; offset < images.length; offset++) {
               const next = (current + offset) % images.length;
               if (loaded[next]) return next;
            }
            return current;
         });
      }, intervalMs);
      return () => window.clearInterval(timer);
   }, [paused, reducedMotion, visible, loaded]);

   return (
      <aside className="login-visual" aria-label="PanelJS image carousel" aria-roledescription="carousel">
         {images.map((src, index) => (
            <img
               key={src}
               className={`login-visual-image ${index === active ? "is-active" : ""}`}
               src={src}
               alt=""
               fetchPriority={index === 0 ? "high" : "low"}
               onLoad={() => setLoaded((current) => current.map((ready, position) => position === index || ready))}
            />
         ))}
         <img className="login-wordmark" src={panelLogo} alt="PanelJS" width="140" height="48" />
         <div className="login-visual-copy">
            <h2>
               A clear space
               <br />
               for your everyday work.
            </h2>
            <p>Your data, your models, one workspace.</p>
         </div>
         <div
            className="login-carousel-controls"
            onFocusCapture={(event) => {
               if (event.target.matches(":focus-visible")) setPaused(true);
            }}
         >
            <div className="login-carousel-dots" role="group" aria-label="Choose an image">
               {images.map((_, index) => (
                  <button
                     key={index}
                     type="button"
                     className="login-carousel-dot"
                     aria-label={`Show image ${index + 1} of ${images.length}`}
                     aria-pressed={active === index}
                     onClick={() => {
                        setActive(index);
                        setPaused(true);
                     }}
                  >
                     <span aria-hidden="true" />
                  </button>
               ))}
            </div>
            {!reducedMotion && (
               <button type="button" className="login-carousel-toggle" aria-label={paused ? "Play slideshow" : "Pause slideshow"} onClick={() => setPaused((current) => !current)}>
                  {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
               </button>
            )}
         </div>
      </aside>
   );
};
