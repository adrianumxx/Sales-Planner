// Design Tokens — Palette Luxury + Typography Impact

export const colors = {
  // Primary gradient (Dynamic Blue to Purple)
  primary: {
    light: '#0F3A7D', // Deep navy
    main: '#1E5BA8', // Ocean blue
    dark: '#2A3F5F', // Slate blue
  },
  accent: {
    vibrant: '#00D9FF', // Cyan accent
    glow: '#6366F1', // Indigo glow
    warm: '#FF6B6B', // Coral for danger/urgent
  },
  status: {
    urgent: '#EF4444', // Red
    warning: '#F59E0B', // Amber
    success: '#10B981', // Emerald
    info: '#3B82F6', // Blue
  },
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  // Dark mode overrides
  dark: {
    bg: '#0A0E27', // Very dark navy
    surface: '#111B3C', // Deep blue-black
    border: '#1E293B', // Slate border
  },
}

export const typography = {
  // Font stack: Geist (modern + clean) + Clash Display (headlines with personality)
  fontFamily: {
    sans: 'var(--font-geist-sans)',
    mono: 'var(--font-geist-mono)',
    display: 'var(--font-clash-display)',
  },
  // Fluid typography (scales smoothly from mobile to desktop)
  fontSize: {
    xs: 'clamp(0.75rem, 1vw, 0.875rem)',
    sm: 'clamp(0.875rem, 1.2vw, 1rem)',
    base: 'clamp(1rem, 1.3vw, 1.125rem)',
    lg: 'clamp(1.125rem, 1.5vw, 1.25rem)',
    xl: 'clamp(1.25rem, 2vw, 1.5rem)',
    '2xl': 'clamp(1.5rem, 2.5vw, 2rem)',
    '3xl': 'clamp(1.875rem, 4vw, 2.25rem)',
    '4xl': 'clamp(2.25rem, 5vw, 3rem)',
    hero: 'clamp(3rem, 8vw, 5rem)',
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.2,
    snug: 1.4,
    normal: 1.6,
    relaxed: 1.8,
  },
}

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
  '4xl': '6rem',
}

export const borderRadius = {
  none: '0',
  sm: '0.375rem',
  md: '0.5rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  full: '9999px',
}

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  // Glassmorphism shadows
  glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  // Glow effects
  glow: '0 0 20px rgba(99, 102, 241, 0.4)',
  glowUrgent: '0 0 30px rgba(239, 68, 68, 0.3)',
}

export const animations = {
  // Entrance
  fadeIn: {
    duration: 0.4,
    ease: 'easeOut',
  },
  slideUp: {
    duration: 0.5,
    ease: 'easeOut',
    y: { initial: 20, target: 0 },
  },
  // Hover
  lift: {
    duration: 0.3,
    y: -4,
  },
  // Loading
  pulse: {
    duration: 1.5,
    opacity: [1, 0.5, 1],
  },
  // Scroll triggers
  scrollReveal: {
    duration: 0.8,
    ease: 'easeOut',
  },
}

export const gradients = {
  // Hero gradients
  primary: 'linear-gradient(135deg, #0F3A7D 0%, #1E5BA8 50%, #2A3F5F 100%)',
  accent: 'linear-gradient(135deg, #00D9FF 0%, #6366F1 100%)',
  danger: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
  // Glassmorphism overlay
  glass: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
  // Dark mode background
  darkBg: 'linear-gradient(135deg, #0A0E27 0%, #111B3C 100%)',
}

export const backdropFilters = {
  glass: 'backdrop-blur(10px) backdrop-saturate(180%)',
  soft: 'backdrop-blur(5px)',
}
