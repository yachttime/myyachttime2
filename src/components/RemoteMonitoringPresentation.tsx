import { useEffect, useRef, useState, type RefObject, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Play } from 'lucide-react';

const VIDEO_URL =
  'https://eqiecntollhgfxmmbize.supabase.co/storage/v1/object/public/myyachttime-media/remote-monitoring/bob-karen-remote-monitoring.mp4';

const totalSlides = 7;

type Card = {
  title: string;
  text: string;
  tag?: string;
};

const riskCards: Card[] = [
  {
    title: 'Weather',
    text: 'Wind, lightning and heavy rain arrive fast on the lake. You hear about it after the damage.',
  },
  {
    title: 'Systems',
    text: 'Bilge pumps, batteries and water systems can fail quietly while you are hours away.',
  },
  {
    title: 'Access',
    text: 'A door left unlatched or a forced hatch can go unnoticed until your next visit.',
  },
];

const monitoringCards: Card[] = [
  { title: 'Bilge and pumps', text: 'Bilge pumps, water pumps and a high-water alarm.' },
  { title: 'Batteries', text: 'Engine, generator and house battery banks, with live voltage.' },
  { title: 'Location', text: 'Live GPS position on a map, so you always know where she is.' },
  { title: 'Weather', text: 'Your own roof station: wind, rain, temperature, humidity, pressure and lightning.' },
  { title: 'Security', text: 'Door and hatch sensors that alert you to entry.', tag: 'Optional add-on' },
  { title: 'Smart locks', text: 'Lock and unlock doors remotely for crew and guests.', tag: 'Coming soon' },
];

const alertCards: Card[] = [
  { title: 'You', text: 'Choose text message or email, and the events that matter to you.' },
  { title: 'Your maintenance company', text: 'Already have a company caring for your yacht? We can alert them too.' },
  { title: 'Our crew', text: 'MyYachtTime staff receive every alert, so it never depends on one phone.' },
  { title: 'On site', text: 'If your yacht needs eyes on it, we send someone to inspect her in person.' },
];

const slideTitleClass = 'text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight text-[#F6F3EC]';
const slideBodyClass = 'text-sm sm:text-lg leading-relaxed text-[#D9E7E6]';
const cardClass = 'rounded-xl border border-[#6CC8C3]/25 bg-[#153A50] p-4 sm:p-5';

const cardGrid = (cards: Card[], columns: string) => (
  <div className={`grid ${columns} gap-3 sm:gap-4`}>
    {cards.map((card) => (
      <div key={card.title} className={cardClass}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h4 className="text-base sm:text-lg font-bold text-[#6CC8C3]">{card.title}</h4>
          {card.tag && (
            <span className="rounded-full border border-[#F59E0B]/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#F59E0B]">
              {card.tag}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm leading-relaxed text-[#F6F3EC]/90">{card.text}</p>
      </div>
    ))}
  </div>
);

const renderSlide = (slide: number, videoRef: RefObject<HTMLVideoElement>) => {
  if (slide === 0) {
    return (
      <div className="flex h-full flex-col justify-center px-6 py-8 sm:px-12 lg:px-16">
        <p className="mb-5 text-xs font-bold tracking-[0.22em] text-[#6CC8C3] sm:text-sm">MYYACHTTIME REMOTE MONITORING</p>
        <h4 className="max-w-4xl text-3xl font-bold leading-[1.08] text-[#F6F3EC] sm:text-5xl lg:text-6xl">
          It&apos;s 2 a.m. A storm is rolling across the lake. Is your yacht okay?
        </h4>
        <p className={`mt-6 max-w-3xl ${slideBodyClass}`}>
          Now you can know. Live pumps, batteries, location and weather, with our crew watching too.
        </p>
      </div>
    );
  }

  if (slide === 1) {
    return (
      <div className="flex h-full flex-col px-5 py-5 sm:px-10 sm:py-7">
        <p className="text-xs font-bold tracking-[0.2em] text-[#6CC8C3] sm:text-sm">SEE IT IN ACTION</p>
        <h4 className="mt-2 text-xl font-bold text-[#F6F3EC] sm:text-3xl">Bob and Karen show how it works</h4>
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center gap-5">
          <video
            ref={videoRef}
            src={VIDEO_URL}
            controls
            playsInline
            className="h-full max-h-[68%] w-auto rounded-lg bg-black shadow-xl"
            style={{ aspectRatio: '9 / 16' }}
          >
            Your browser does not support the video tag.
          </video>
          <p className="hidden max-w-xs text-sm leading-relaxed text-[#D9E7E6] lg:block">
            A storm hits the lake. Bob pulls up Karen&apos;s boat from his office: pumps, batteries, location and weather, all on one screen.
          </p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#D9E7E6] lg:hidden">
          A storm hits the lake. Bob pulls up Karen&apos;s boat from his office: pumps, batteries, location and weather, all on one screen.
        </p>
      </div>
    );
  }

  if (slide === 2) {
    return (
      <div className="flex h-full flex-col justify-center px-5 py-6 sm:px-10 sm:py-8">
        <h4 className={slideTitleClass}>A yacht sitting alone is a yacht at risk</h4>
        <div className="mt-5">{cardGrid(riskCards, 'grid-cols-1 md:grid-cols-3')}</div>
        <p className="mt-5 border-l-2 border-[#F59E0B] pl-4 text-xs leading-relaxed text-[#F6F3EC]/85 sm:text-sm">
          Many insurers now expect a management company to inspect boats whose owners live more than three hours away, every two to four weeks.
        </p>
      </div>
    );
  }

  if (slide === 3) {
    return (
      <div className="flex h-full flex-col justify-center px-5 py-6 sm:px-10 sm:py-8">
        <h4 className={slideTitleClass}>What we watch on your yacht</h4>
        <div className="mt-5">{cardGrid(monitoringCards, 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}</div>
      </div>
    );
  }

  if (slide === 4) {
    return (
      <div className="flex h-full flex-col justify-center px-5 py-6 sm:px-10 sm:py-8">
        <h4 className={slideTitleClass}>The right people hear about it first</h4>
        <div className="mt-5">{cardGrid(alertCards, 'grid-cols-1 sm:grid-cols-2')}</div>
        <p className="mt-5 border-l-2 border-[#F59E0B] pl-4 text-xs leading-relaxed text-[#F6F3EC]/85 sm:text-sm">
          Optional response service: 24/7/365 coverage with a response within one hour. Rates are agreed separately.
        </p>
      </div>
    );
  }

  if (slide === 5) {
    return (
      <div className="flex h-full flex-col justify-center px-4 py-5 sm:px-10 sm:py-8">
        <h4 className={slideTitleClass}>Daily eyes, not occasional visits</h4>
        <div className="mt-5 overflow-hidden rounded-xl border border-[#6CC8C3]/30">
          <table className="w-full table-fixed border-collapse text-left text-[10px] sm:text-sm">
            <thead className="bg-[#153A50] text-[#6CC8C3]">
              <tr>
                <th className="w-1/4 p-2 sm:p-3" />
                <th className="w-[37.5%] p-2 sm:p-3">Periodic inspection</th>
                <th className="w-[37.5%] p-2 sm:p-3">Remote monitoring</th>
              </tr>
            </thead>
            <tbody className="text-[#F6F3EC]">
              <tr className="border-t border-[#6CC8C3]/20">
                <th className="p-2 font-semibold text-[#6CC8C3] sm:p-3">How often</th>
                <td className="p-2 sm:p-3">Every two to four weeks</td>
                <td className="p-2 sm:p-3">Continuous, around the clock</td>
              </tr>
              <tr className="border-t border-[#6CC8C3]/20 bg-[#153A50]/50">
                <th className="p-2 font-semibold text-[#6CC8C3] sm:p-3">What is checked</th>
                <td className="p-2 sm:p-3">What an inspector sees that day</td>
                <td className="p-2 sm:p-3">Pumps, batteries, location, weather and security</td>
              </tr>
              <tr className="border-t border-[#6CC8C3]/20">
                <th className="p-2 font-semibold text-[#6CC8C3] sm:p-3">Between checks</th>
                <td className="p-2 sm:p-3">No one is watching</td>
                <td className="p-2 sm:p-3">Alerts to you and our crew</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-5 border-l-2 border-[#F59E0B] pl-4 text-xs leading-relaxed text-[#F6F3EC]/85 sm:text-sm">
          Designed to meet and go beyond management-company inspection requirements. Please confirm your own insurer&apos;s policy.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center px-6 py-8 sm:px-12 lg:px-16">
      <p className="mb-4 text-xs font-bold tracking-[0.2em] text-[#6CC8C3] sm:text-sm">MYYACHTTIME REMOTE MONITORING</p>
      <h4 className={slideTitleClass}>Let MyYachtTime keep an eye on your yacht.</h4>
      <p className={`mt-5 max-w-2xl ${slideBodyClass}`}>
        Ask us about Remote Monitoring today. Our team installs and sets up everything aboard.
      </p>
      <div className="mt-7 flex flex-col items-start gap-2 text-sm font-semibold sm:text-base">
        <a href="tel:480-250-6270" className="text-[#F59E0B] transition-colors hover:text-[#F6F3EC]">480-250-6270</a>
        <a href="mailto:info@myyachttime.com" className="text-[#F59E0B] transition-colors hover:text-[#F6F3EC]">info@myyachttime.com</a>
        <span className="text-[#6CC8C3]">myyachttime.com</span>
      </div>
    </div>
  );
};

export const RemoteMonitoringPresentation = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const presentationRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number | null>(null);

  const changeSlide = (nextSlide: number) => {
    setActiveSlide((nextSlide + totalSlides) % totalSlides);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') changeSlide(activeSlide - 1);
      if (event.key === 'ArrowRight') changeSlide(activeSlide + 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlide]);

  useEffect(() => {
    if (activeSlide !== 1) videoRef.current?.pause();
  }, [activeSlide]);

  useEffect(() => () => videoRef.current?.pause(), []);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(distance) > 48) changeSlide(activeSlide + (distance < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const handleFullscreen = async () => {
    if (!presentationRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await presentationRef.current.requestFullscreen();
  };

  return (
    <div
      ref={presentationRef}
      className="overflow-hidden rounded-2xl bg-[#0F2A3F] shadow-2xl ring-1 ring-white/10"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative aspect-video w-full">
        <div className="absolute inset-0">{renderSlide(activeSlide, videoRef)}</div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-5">
          <button
            type="button"
            onClick={() => changeSlide(activeSlide - 1)}
            aria-label="Previous slide"
            className="pointer-events-auto rounded-full bg-[#0F2A3F]/90 p-2 text-[#F6F3EC] transition hover:bg-[#6CC8C3] hover:text-[#0F2A3F]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#0F2A3F]/90 px-3 py-2">
            {Array.from({ length: totalSlides }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => changeSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-2 rounded-full transition-all ${index === activeSlide ? 'w-6 bg-[#F59E0B]' : 'w-2 bg-[#F6F3EC]/50 hover:bg-[#6CC8C3]'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => changeSlide(activeSlide + 1)}
            aria-label="Next slide"
            className="pointer-events-auto rounded-full bg-[#0F2A3F]/90 p-2 text-[#F6F3EC] transition hover:bg-[#6CC8C3] hover:text-[#0F2A3F]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleFullscreen}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-[#0F2A3F]/90 px-3 py-2 text-xs font-semibold text-[#F6F3EC] transition hover:bg-[#F59E0B] hover:text-[#0F2A3F] sm:right-5 sm:top-5 sm:text-sm"
        >
          <Maximize className="h-4 w-4" />
          Full screen
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 bg-[#0B2030] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6CC8C3] sm:text-xs">
        <span>Slide {activeSlide + 1} of {totalSlides}</span>
        {activeSlide === 1 && (
          <span className="flex items-center gap-1 text-[#F6F3EC]/70"><Play className="h-3 w-3" /> Video with sound</span>
        )}
      </div>
    </div>
  );
};
