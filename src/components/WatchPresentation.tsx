import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Anchor,
  ChevronLeft,
  ChevronRight,
  Play,
  Phone,
  Mail,
  Globe,
  Droplets,
  Battery,
  MapPin,
  CloudRain,
  Shield,
  Lock,
  Bell,
  Users,
  Eye,
  Waves,
  Camera,
  CheckCircle2,
} from 'lucide-react';

const VIDEO_URL =
  'https://eqiecntollhgfxmmbize.supabase.co/storage/v1/object/public/myyachttime-media/remote-monitoring/bob-karen-remote-monitoring.mp4';

const YACHT_PHOTO = '/yacht-card/image.png';

const NAVY = '#0F2A3F';
const CARD_NAVY = '#163B55';
const CREAM = '#F6F3EC';
const TEAL = '#6CC8C3';
const AMBER = '#E3A53B';
const DARK_TEAL = '#136A6A';
const MUTED_DARK = '#C9D6DE';
const MUTED_CREAM = '#5B6B78';

const FONT_HEADING = '"EB Garamond", Georgia, serif';
const FONT_BODY = '"DM Sans", system-ui, sans-serif';

type Theme = 'navy' | 'cream';

// ─── Icon helper ──────────────────────────────────────────────
function Icon({ name, className }: { name: string; className?: string }) {
  const map: Record<string, typeof Anchor> = {
    droplets: Droplets,
    battery: Battery,
    mapPin: MapPin,
    cloudRain: CloudRain,
    shield: Shield,
    lock: Lock,
    bell: Bell,
    users: Users,
    eye: Eye,
    waves: Waves,
    camera: Camera,
    check: CheckCircle2,
  };
  const C = map[name] || Anchor;
  return <C className={className} />;
}

// ─── Card ─────────────────────────────────────────────────────
function Card({
  theme,
  icon,
  title,
  children,
  tag,
}: {
  theme: Theme;
  icon: string;
  title: string;
  children: React.ReactNode;
  tag?: string;
}) {
  const dark = theme === 'navy';
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 flex flex-col h-full"
      style={{
        background: dark ? CARD_NAVY : '#FFFFFF',
        border: dark ? `1px solid ${DARK_TEAL}55` : `1px solid #E2DED4`,
      }}
    >
      <div
        className="flex items-center gap-3 mb-3"
      >
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: 40,
            height: 40,
            background: dark ? `${TEAL}22` : `${DARK_TEAL}18`,
          }}
        >
          <Icon name={icon} className="w-5 h-5" />
        </div>
        <h3
          className="font-semibold leading-tight"
          style={{
            fontFamily: FONT_HEADING,
            fontSize: '1.15rem',
            color: dark ? CREAM : NAVY,
          }}
        >
          {title}
        </h3>
      </div>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: '0.9rem',
          lineHeight: 1.55,
          color: dark ? MUTED_DARK : MUTED_CREAM,
          margin: 0,
        }}
      >
        {children}
      </p>
      {tag && (
        <span
          className="mt-3 self-start rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: dark ? `${AMBER}22` : `${AMBER}1A`,
            color: AMBER,
            fontFamily: FONT_BODY,
          }}
        >
          {tag}
        </span>
      )}
    </div>
  );
}

// ─── Slide label ──────────────────────────────────────────────
function Label({ text, theme }: { text: string; theme: Theme }) {
  return (
    <div
      className="inline-flex items-center gap-2 mb-4"
      style={{ color: TEAL, fontFamily: FONT_BODY, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}
    >
      <span style={{ width: 24, height: 2, background: TEAL, display: 'inline-block' }} />
      {text}
    </div>
  );
}

// ─── Slide heading ────────────────────────────────────────────
function Heading({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <h2
      style={{
        fontFamily: FONT_HEADING,
        fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
        fontWeight: 600,
        lineHeight: 1.2,
        color: theme === 'navy' ? CREAM : NAVY,
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

// ─── Footer text ──────────────────────────────────────────────
function SlideFooter({ theme }: { theme: Theme }) {
  return (
    <div
      className="absolute bottom-3 left-0 right-0 text-center"
      style={{
        fontFamily: FONT_BODY,
        fontSize: '0.7rem',
        color: theme === 'navy' ? `${MUTED_DARK}99` : `${MUTED_CREAM}99`,
        letterSpacing: '0.05em',
      }}
    >
      MyYachtTime Remote Monitoring
    </div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────
function PricingCard({
  name,
  price,
  badge,
  features,
  rows,
  highlight,
}: {
  name: string;
  price: string;
  badge?: string;
  features: string[];
  rows: { label: string; value: string }[];
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 flex flex-col h-full relative"
      style={{
        background: '#FFFFFF',
        border: highlight ? `2px solid ${TEAL}` : `1px solid #E2DED4`,
      }}
    >
      {badge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold"
          style={{ background: AMBER, color: NAVY, fontFamily: FONT_BODY }}
        >
          {badge}
        </span>
      )}
      <h3
        style={{ fontFamily: FONT_HEADING, fontSize: '1.4rem', fontWeight: 600, color: NAVY, margin: '0 0 0.25rem' }}
      >
        {name}
      </h3>
      <div style={{ fontFamily: FONT_BODY, fontSize: '0.95rem', color: MUTED_CREAM, marginBottom: '0.75rem' }}>
        {price}
      </div>
      <ul className="mb-4 space-y-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2" style={{ fontFamily: FONT_BODY, fontSize: '0.85rem', color: MUTED_CREAM, lineHeight: 1.4 }}>
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TEAL }} />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-3" style={{ borderTop: `1px solid #E2DED4` }}>
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between" style={{ fontFamily: FONT_BODY, fontSize: '0.8rem', padding: '0.15rem 0' }}>
            <span style={{ color: MUTED_CREAM }}>{r.label}</span>
            <span style={{ color: NAVY, fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Slide content renderer ───────────────────────────────────
function SlideContent({ index, theme }: { index: number; theme: Theme }) {
  const dark = theme === 'navy';
  const textColor = dark ? MUTED_DARK : MUTED_CREAM;

  // Slide 1: COVER
  if (index === 0) {
    return (
      <div className="h-full flex flex-col lg:flex-row items-center gap-6 lg:gap-10 px-6 sm:px-10 lg:px-16 pt-8 lg:pt-10">
        <div className="flex-1 flex flex-col justify-center max-w-xl">
          <Label text="MyYachtTime Remote Monitoring" theme={theme} />
          <h2 style={{ fontFamily: FONT_HEADING, fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 600, lineHeight: 1.15, color: CREAM, margin: 0 }}>
            It's <span style={{ color: AMBER }}>2 a.m.</span> A storm is rolling across the lake. Is your yacht okay?
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', lineHeight: 1.6, color: MUTED_DARK, marginTop: '1.25rem' }}>
            Now you can know. Live pumps, batteries, location and weather, with our crew watching too.
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center w-full max-w-md lg:max-w-lg">
          <img
            src={YACHT_PHOTO}
            alt="Yacht on the lake"
            className="rounded-2xl w-full h-auto object-cover"
            style={{ maxHeight: '60vh', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
          />
        </div>
      </div>
    );
  }

  // Slide 2: VIDEO
  if (index === 1) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 sm:px-10 pt-6">
        <Label text="See it in action" theme={theme} />
        <Heading theme={theme}>Bob and Karen show how it works</Heading>
        <p style={{ fontFamily: FONT_BODY, fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', lineHeight: 1.55, color: textColor, textAlign: 'center', maxWidth: '42rem' }}>
          A storm hits the lake. Bob pulls up Karen's boat from his office: pumps, batteries, location and weather, all on one screen.
        </p>
        <div className="flex-1 flex items-center justify-center w-full min-h-0" style={{ minHeight: 0 }}>
          <video
            src={VIDEO_URL}
            controls
            playsInline
            className="rounded-2xl"
            style={{ maxHeight: '52vh', maxWidth: '100%', aspectRatio: '9 / 16', height: '100%', background: '#000' }}
          />
        </div>
      </div>
    );
  }

  // Slide 3: PROBLEM
  if (index === 2) {
    return (
      <div className="h-full flex flex-col justify-center px-6 sm:px-10 lg:px-16 pt-6 lg:pt-8">
        <Heading theme={theme}>A yacht sitting alone is a yacht at risk</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <Card theme={theme} icon="cloudRain" title="Weather">Wind, lightning and heavy rain arrive fast on the lake. You hear about it after the damage.</Card>
          <Card theme={theme} icon="droplets" title="Systems">Bilge pumps, batteries and water systems can fail quietly while you are hours away.</Card>
          <Card theme={theme} icon="shield" title="Access">A door left unlatched or a forced hatch can go unnoticed until your next visit.</Card>
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: '0.9rem', lineHeight: 1.55, color: textColor, marginTop: '1.25rem', maxWidth: '50rem' }}>
          Many insurers now expect a management company to inspect boats whose owners live more than three hours away, every two to four weeks.
        </p>
      </div>
    );
  }

  // Slide 4: WHAT WE WATCH
  if (index === 3) {
    const items = [
      { icon: 'droplets', title: 'Bilge and pumps', text: 'Bilge pumps, water pumps and a high-water alarm.' },
      { icon: 'battery', title: 'Batteries', text: 'Engine, generator and house battery banks, with live voltage.' },
      { icon: 'mapPin', title: 'Location', text: 'Live GPS position on a map, so you always know where she is.' },
      { icon: 'cloudRain', title: 'Weather', text: 'Your own roof station: wind, rain, temperature, humidity, pressure and lightning.' },
      { icon: 'shield', title: 'Security', text: 'Door and hatch sensors that alert you to entry.', tag: 'Optional add-on' },
      { icon: 'lock', title: 'Smart locks', text: 'Lock and unlock doors remotely for crew and guests.', tag: 'Coming soon' },
    ];
    return (
      <div className="h-full flex flex-col justify-center px-6 sm:px-10 lg:px-16 pt-6 lg:pt-8">
        <Heading theme={theme}>What we watch on your yacht</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {items.map((it, i) => (
            <Card key={i} theme={theme} icon={it.icon} title={it.title} tag={it.tag}>{it.text}</Card>
          ))}
        </div>
      </div>
    );
  }

  // Slide 5: ALERTS
  if (index === 4) {
    const items = [
      { icon: 'bell', title: 'You', text: 'Choose text message or email, and the events that matter to you.' },
      { icon: 'users', title: 'Your maintenance company', text: 'Already have a company caring for your yacht? We can alert them too.' },
      { icon: 'eye', title: 'Our crew', text: 'MyYachtTime staff receive every alert, so it never depends on one phone.' },
      { icon: 'waves', title: 'On site', text: 'If your yacht needs eyes on it, we send someone to inspect her in person.' },
    ];
    return (
      <div className="h-full flex flex-col justify-center px-6 sm:px-10 lg:px-16 pt-6 lg:pt-8">
        <Heading theme={theme}>The right people hear about it first</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {items.map((it, i) => (
            <Card key={i} theme={theme} icon={it.icon} title={it.title}>{it.text}</Card>
          ))}
        </div>
        <div
          className="rounded-2xl mt-5 p-5"
          style={{ background: `${AMBER}1A`, border: `1px solid ${AMBER}55` }}
        >
          <h3 style={{ fontFamily: FONT_HEADING, fontSize: '1.15rem', fontWeight: 600, color: AMBER, margin: '0 0 0.4rem' }}>
            Alerts you design yourself
          </h3>
          <p style={{ fontFamily: FONT_BODY, fontSize: '0.88rem', lineHeight: 1.55, color: MUTED_DARK, margin: 0 }}>
            Need a warning at 3 a.m. that the wind outside is excessive, so you can check your anchor lines? Tell us what matters and we set it up.
          </p>
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: '0.8rem', color: `${textColor}aa`, marginTop: '0.75rem' }}>
          Optional response service: 24/7/365 coverage with a response within one hour. Rates are agreed separately.
        </p>
      </div>
    );
  }

  // Slide 6: AWAY
  if (index === 5) {
    const items = [
      { icon: 'waves', title: 'Away from the boat', text: 'Surfing, or after that huge largemouth bass? If a bilge pump runs too long or your A/C pump shuts down, our staff gets the alert. We will know before you do.' },
      { icon: 'mapPin', title: 'Storm on the lake', text: 'Our GPS tracker shows exactly where your yacht is, so we are never guessing during a storm.' },
      { icon: 'users', title: 'Crew on patrol', text: 'If we are out patrolling the lake in a storm, we can swing by and check on your yacht in person.' },
      { icon: 'bell', title: 'Many more options', text: 'Remote monitoring adapts to how you use your yacht. Ask us what we can watch for you.' },
    ];
    return (
      <div className="h-full flex flex-col justify-center px-6 sm:px-10 lg:px-16 pt-6 lg:pt-8">
        <Heading theme={theme}>Out on the lake? We are still watching.</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {items.map((it, i) => (
            <Card key={i} theme={theme} icon={it.icon} title={it.title}>{it.text}</Card>
          ))}
        </div>
      </div>
    );
  }

  // Slide 7: COMPARISON
  if (index === 6) {
    const rows = [
      { label: 'How often', periodic: 'Every two to four weeks', remote: 'Continuous, around the clock' },
      { label: 'What is checked', periodic: 'What an inspector sees that day', remote: 'Pumps, batteries, location, weather and security' },
      { label: 'Between checks', periodic: 'No one is watching', remote: 'Alerts to you and our crew' },
    ];
    return (
      <div className="h-full flex flex-col justify-center px-6 sm:px-10 lg:px-16 pt-6 lg:pt-8">
        <Heading theme={theme}>Daily eyes, not occasional visits</Heading>
        <div className="mt-5 overflow-hidden rounded-2xl" style={{ border: `1px solid ${DARK_TEAL}55` }}>
          <div className="grid grid-cols-3" style={{ background: CARD_NAVY }}>
            <div className="p-3 sm:p-4" style={{ fontFamily: FONT_HEADING, fontSize: '1rem', fontWeight: 600, color: MUTED_DARK }}>
              &nbsp;
            </div>
            <div className="p-3 sm:p-4 text-center" style={{ fontFamily: FONT_HEADING, fontSize: '1rem', fontWeight: 600, color: MUTED_DARK }}>
              Periodic inspection
            </div>
            <div className="p-3 sm:p-4 text-center" style={{ fontFamily: FONT_HEADING, fontSize: '1rem', fontWeight: 600, color: TEAL }}>
              Remote monitoring
            </div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-3"
              style={{ background: i % 2 === 0 ? NAVY : CARD_NAVY, borderTop: `1px solid ${DARK_TEAL}33` }}
            >
              <div className="p-3 sm:p-4" style={{ fontFamily: FONT_BODY, fontSize: '0.85rem', fontWeight: 600, color: CREAM }}>
                {r.label}
              </div>
              <div className="p-3 sm:p-4" style={{ fontFamily: FONT_BODY, fontSize: '0.85rem', color: MUTED_DARK, lineHeight: 1.45 }}>
                {r.periodic}
              </div>
              <div className="p-3 sm:p-4" style={{ fontFamily: FONT_BODY, fontSize: '0.85rem', color: CREAM, lineHeight: 1.45 }}>
                {r.remote}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: '0.8rem', color: `${textColor}aa`, marginTop: '0.75rem' }}>
          Designed to meet and go beyond management-company inspection requirements. Please confirm your own insurer's policy.
        </p>
      </div>
    );
  }

  // Slide 8: PRICING
  if (index === 7) {
    return (
      <div className="h-full flex flex-col justify-center px-6 sm:px-10 lg:px-12 pt-6 lg:pt-8">
        <Heading theme={theme}>Simple plans, installed for you</Heading>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
          <PricingCard
            name="Standard"
            price="$49/month billed annually"
            features={['GPS location', 'Indoor temperature and humidity', 'Up to 3 pumps, 2 battery banks']}
            rows={[
              { label: 'Equipment', value: '$1,537.50' },
              { label: 'Installation (8 hrs)', value: '$2,400' },
              { label: 'One-time install', value: '$3,937.50' },
              { label: 'First year total', value: '$4,525.50' },
            ]}
          />
          <PricingCard
            name="Pro"
            price="$89/month billed annually"
            badge="Most popular"
            highlight
            features={['Everything in Standard', 'Up to 8 pumps, 6 battery banks', 'Engine hours and weather station']}
            rows={[
              { label: 'Equipment', value: '$3,492' },
              { label: 'Installation (10 hrs)', value: '$3,000' },
              { label: 'One-time install', value: '$6,492' },
              { label: 'First year total', value: '$7,560' },
            ]}
          />
          <PricingCard
            name="Pro + Security"
            price="$129/month billed annually"
            features={['Everything in Pro', '2 cameras with motion clips', 'Smart door locks and entry log']}
            rows={[
              { label: 'Equipment', value: '$6,159' },
              { label: 'Installation (15 hrs)', value: '$4,500' },
              { label: 'One-time install', value: '$10,659' },
              { label: 'First year total', value: '$12,207' },
            ]}
          />
        </div>
        <p style={{ fontFamily: FONT_BODY, fontSize: '1rem', fontWeight: 700, color: AMBER, marginTop: '1rem' }}>
          Pricing can vary based on the equipment on your boat.
        </p>
        <p style={{ fontFamily: FONT_BODY, fontSize: '0.8rem', color: MUTED_CREAM, marginTop: '0.4rem' }}>
          Installation is a one-time charge. Extra camera $10/month. Prices in USD; subject to change. 480-250-6270 · info@myyachttime.com
        </p>
      </div>
    );
  }

  // Slide 9: CONTACT
  if (index === 8) {
    return (
      <div className="h-full flex flex-col lg:flex-row items-center gap-6 lg:gap-10 px-6 sm:px-10 lg:px-16 pt-8 lg:pt-10">
        <div className="flex-1 flex flex-col justify-center max-w-xl">
          <Heading theme={theme}>Let MyYachtTime keep an eye on your yacht.</Heading>
          <p style={{ fontFamily: FONT_BODY, fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', lineHeight: 1.6, color: MUTED_DARK, marginTop: '1rem' }}>
            Ask us about Remote Monitoring today. Our team installs and sets up everything aboard.
          </p>
          <div className="mt-6 space-y-2.5">
            <a href="tel:480-250-6270" className="flex items-center gap-3 no-underline" style={{ color: TEAL, fontFamily: FONT_BODY, fontSize: '1.1rem', fontWeight: 600 }}>
              <Phone className="w-5 h-5" /> 480-250-6270
            </a>
            <a href="mailto:info@myyachttime.com" className="flex items-center gap-3 no-underline" style={{ color: TEAL, fontFamily: FONT_BODY, fontSize: '1.1rem', fontWeight: 600 }}>
              <Mail className="w-5 h-5" /> info@myyachttime.com
            </a>
            <a href="https://myyachttime.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 no-underline" style={{ color: TEAL, fontFamily: FONT_BODY, fontSize: '1.1rem', fontWeight: 600 }}>
              <Globe className="w-5 h-5" /> myyachttime.com
            </a>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center w-full max-w-md lg:max-w-lg">
          <img
            src={YACHT_PHOTO}
            alt="Yacht on the lake"
            className="rounded-2xl w-full h-auto object-cover"
            style={{ maxHeight: '55vh', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────
const TOTAL_SLIDES = 9;
const THEMES: Theme[] = ['navy', 'navy', 'cream', 'cream', 'navy', 'cream', 'navy', 'cream', 'navy'];

export const WatchPresentation = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      if (isAnimating) return;
      const clamped = Math.max(0, Math.min(TOTAL_SLIDES - 1, next));
      if (clamped === current) return;
      setDirection(clamped > current ? 1 : -1);
      setIsAnimating(true);
      setCurrent(clamped);
      window.setTimeout(() => setIsAnimating(false), 500);
    },
    [current, isAnimating]
  );

  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  // Touch / swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  const theme = THEMES[current];
  const dark = theme === 'navy';
  const bgColor = dark ? NAVY : CREAM;
  const iconColor = dark ? CREAM : NAVY;
  const btnBg = dark ? CARD_NAVY : '#FFFFFF';
  const btnBorder = dark ? `${DARK_TEAL}66` : '#D8D2C6';

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: bgColor, fontFamily: FONT_BODY }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0"
        style={{ borderBottom: dark ? `1px solid ${DARK_TEAL}33` : `1px solid #E0DBD0` }}
      >
        <div className="flex items-center gap-2">
          <Anchor className="w-6 h-6" style={{ color: AMBER }} />
          <span style={{ fontFamily: FONT_HEADING, fontSize: '1.1rem', fontWeight: 600, color: iconColor, letterSpacing: '0.02em' }}>
            MyYachtTime
          </span>
        </div>
        <span style={{ fontFamily: FONT_BODY, fontSize: '0.8rem', color: dark ? MUTED_DARK : MUTED_CREAM, letterSpacing: '0.05em' }}>
          Remote Monitoring
        </span>
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <div
          key={current}
          className="absolute inset-0 flex flex-col"
          style={{
            animation: 'rmFadeIn 0.5s ease-out',
          }}
        >
          {/* Slide 16:9 container */}
          <div className="flex-1 flex items-center justify-center min-h-0 relative">
            <div
              className="w-full"
              style={{
                aspectRatio: '16 / 9',
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'min(100%, calc(100vh * 16 / 9))',
                position: 'relative',
              }}
            >
              <SlideContent index={current} theme={theme} />
              <SlideFooter theme={theme} />
            </div>
          </div>
        </div>

        {/* Prev button */}
        {current > 0 && (
          <button
            onClick={goPrev}
            aria-label="Previous slide"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10"
            style={{
              width: 44,
              height: 44,
              background: btnBg,
              border: `1px solid ${btnBorder}`,
              color: iconColor,
              opacity: 0.85,
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Next button */}
        {current < TOTAL_SLIDES - 1 && (
          <button
            onClick={goNext}
            aria-label="Next slide"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all hover:scale-110 z-10"
            style={{
              width: 44,
              height: 44,
              background: btnBg,
              border: `1px solid ${btnBorder}`,
              color: iconColor,
              opacity: 0.85,
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom controls: counter + dots */}
      <div
        className="flex items-center justify-center gap-4 px-4 py-3 shrink-0"
        style={{ borderTop: dark ? `1px solid ${DARK_TEAL}33` : `1px solid #E0DBD0` }}
      >
        {/* Counter */}
        <span style={{ fontFamily: FONT_BODY, fontSize: '0.85rem', fontWeight: 600, color: iconColor }}>
          {current + 1} / {TOTAL_SLIDES}
        </span>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="rounded-full transition-all"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                background: i === current ? TEAL : dark ? `${MUTED_DARK}55` : `${MUTED_CREAM}55`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes rmFadeIn {
          from { opacity: 0; transform: translateX(${direction * 30}px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};
