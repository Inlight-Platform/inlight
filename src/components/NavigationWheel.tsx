import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

/*
 * TARGET-NODE TO SPOKE MAPPING (REPEAT IN CODE COMMENTS)
 * Stories       #FF4FA4 - 0°
 * Mutuals       #00F5FF - 45°
 * Insights      #FFD400 - 90°
 * Events        #FF6B2D - 135°
 * Opportunities #00FF87 - 180°
 * Messages      #AE6DFF - 225°
 * My Network    #FF4D4D - 270°
 * Resources     #39FFDC - 315°
 */

interface SpokeConfig {
  name: string;
  route: string;
  color: string;
  angle: number;
}

const spokes: SpokeConfig[] = [
  { name: 'Stories', route: '/stories', color: '#FF4FA4', angle: 0 },
  { name: 'Mutuals', route: '/mutuals', color: '#00F5FF', angle: 45 },
  { name: 'Insights', route: '/insights', color: '#FFD400', angle: 90 },
  { name: 'Events', route: '/events', color: '#FF6B2D', angle: 135 },
  { name: 'Opportunities', route: '/opportunities', color: '#00FF87', angle: 180 },
  { name: 'Messages', route: '/messages', color: '#AE6DFF', angle: 225 },
  { name: 'My Network', route: '/network', color: '#FF4D4D', angle: 270 },
  { name: 'Resources', route: '/resources', color: '#39FFDC', angle: 315 },
];

/*
 * WHEEL GEOMETRY (MANDATORY)
 * View-box: 600 × 600.
 * Center hub: cx=300, cy=300, r=90.
 * Eight spokes: 45° each.
 * Each spoke is a line (stroke-width 10 px) that starts at hub edge (r=90) and ends at target-node center (r=250).
 * Target-node: circle r=24 px (48 px diameter) centered at the end of the spoke line.
 */

const VIEWBOX_SIZE = 600;
const CENTER = VIEWBOX_SIZE / 2; // 300
const HUB_RADIUS = 90;
const SPOKE_END_RADIUS = 250;
const TARGET_NODE_RADIUS = 24;

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

export const NavigationWheel: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.getCurrentUser());
  const streak = useStore((s) => s.getStreak(currentUser?.id || ''));
  
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const targetRefs = useRef<(SVGGElement | null)[]>([]);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % spokes.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + spokes.length) % spokes.length);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setFocusedIndex(-1);
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      navigate(spokes[focusedIndex].route);
    }
  }, [focusedIndex, navigate]);
  
  useEffect(() => {
    if (focusedIndex >= 0 && targetRefs.current[focusedIndex]) {
      targetRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);
  
  const handleHubClick = () => {
    navigate('/profile/me');
  };
  
  const handleSpokeClick = (index: number) => {
    navigate(spokes[index].route);
  };
  
  const streakPercentage = (streak / 7) * 100;
  const streakDasharray = `${(streakPercentage / 100) * (2 * Math.PI * 85)} ${2 * Math.PI * 85}`;
  
  return (
    <div 
      className="flex items-center justify-center w-full h-full p-4"
      onKeyDown={handleKeyDown}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className="w-full h-full max-w-[600px] max-h-[600px]"
        role="navigation"
        aria-label="Main navigation wheel"
      >
        <defs>
          {/* Gradients for each spoke */}
          {spokes.map((spoke, index) => (
            <linearGradient
              key={`gradient-${index}`}
              id={`gradient-${index}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={spoke.color} />
              <stop offset="100%" stopColor={spoke.color} stopOpacity="0.8" />
            </linearGradient>
          ))}
          
          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Avatar clip path */}
          <clipPath id="avatarClip">
            <circle cx={CENTER} cy={CENTER} r={70} />
          </clipPath>
        </defs>
        
        {/* Spoke lines */}
        {spokes.map((spoke, index) => {
          const startPoint = polarToCartesian(CENTER, CENTER, HUB_RADIUS, spoke.angle);
          const endPoint = polarToCartesian(CENTER, CENTER, SPOKE_END_RADIUS, spoke.angle);
          const isHovered = hoveredIndex === index;
          
          return (
            <line
              key={`spoke-line-${index}`}
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
              className="spoke-line"
              strokeWidth={isHovered ? 14 : 10}
              strokeLinecap="round"
              style={{
                transition: prefersReducedMotion ? 'opacity 0.2s' : 'stroke-width 0.2s',
              }}
            />
          );
        })}
        
        {/* Target nodes */}
        {spokes.map((spoke, index) => {
          const position = polarToCartesian(CENTER, CENTER, SPOKE_END_RADIUS, spoke.angle);
          const isHovered = hoveredIndex === index;
          const isFocused = focusedIndex === index;
          
          return (
            <g
              key={`target-${index}`}
              ref={(el) => (targetRefs.current[index] = el)}
              role="button"
              aria-label={`Open ${spoke.name}`}
              tabIndex={0}
              onClick={() => handleSpokeClick(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(-1)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(-1)}
              style={{
                cursor: 'pointer',
                outline: 'none',
                transform: isHovered && !prefersReducedMotion ? 'scale(1.15)' : 'scale(1)',
                transformOrigin: `${position.x}px ${position.y}px`,
                transition: prefersReducedMotion ? 'opacity 0.2s' : 'transform 0.2s ease-out',
                opacity: prefersReducedMotion && isHovered ? 0.8 : 1,
              }}
            >
              {/* Hit area (invisible, 80px total) */}
              <circle
                cx={position.x}
                cy={position.y}
                r={TARGET_NODE_RADIUS + 16}
                fill="transparent"
              />
              
              {/* Focus ring */}
              {isFocused && (
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={TARGET_NODE_RADIUS + 6}
                  fill="none"
                  stroke="#00F5FF"
                  strokeWidth={2}
                  style={{ borderRadius: '50%' }}
                />
              )}
              
              {/* Target node */}
              <circle
                cx={position.x}
                cy={position.y}
                r={TARGET_NODE_RADIUS}
                fill={`url(#gradient-${index})`}
                filter={isHovered ? 'url(#glow)' : undefined}
                style={{
                  filter: isHovered ? `drop-shadow(0 0 14px ${spoke.color})` : undefined,
                }}
              />
              
              {/* Label */}
              <text
                x={position.x}
                y={position.y + TARGET_NODE_RADIUS + 20}
                textAnchor="middle"
                className="fill-foreground text-xs font-medium"
                style={{ pointerEvents: 'none' }}
              >
                {spoke.name}
              </text>
            </g>
          );
        })}
        
        {/* Center hub */}
        <g
          role="button"
          aria-label="Open your profile"
          tabIndex={0}
          onClick={handleHubClick}
          onKeyDown={(e) => e.key === 'Enter' && handleHubClick()}
          style={{ cursor: 'pointer', outline: 'none' }}
          className="group"
        >
          {/* Hub background */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            className="fill-card stroke-border"
            strokeWidth={2}
          />
          
          {/* Streak ring */}
          {streak > 0 && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={85}
              fill="none"
              stroke="#00FF87"
              strokeWidth={4}
              strokeDasharray={streakDasharray}
              strokeLinecap="round"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              className={prefersReducedMotion ? '' : 'streak-ring'}
            />
          )}
          
          {/* Avatar */}
          {currentUser?.avatar && (
            <image
              href={currentUser.avatar}
              x={CENTER - 70}
              y={CENTER - 70}
              width={140}
              height={140}
              clipPath="url(#avatarClip)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          
          {/* Edit icon */}
          <g transform={`translate(${CENTER + 50}, ${CENTER - 60})`}>
            <circle
              r={16}
              className="fill-primary"
            />
            <path
              d="M-5 3L5 -7M-7 5L-5 3M5 -7L7 -5"
              fill="none"
              className="stroke-primary-foreground"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
          
          {/* Hover effect */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            fill="transparent"
            className="group-hover:fill-foreground/5 transition-colors"
          />
        </g>
      </svg>
    </div>
  );
};

export default NavigationWheel;
