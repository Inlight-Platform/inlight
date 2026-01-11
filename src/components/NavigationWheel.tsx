import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import inlightLogo from '@/assets/inlight-logo.png';

/*
 * REDESIGNED WHEEL - Apple-style sleek, minimal, monochrome + cyan accent
 * 12 ultra-thin matte-black spokes (2px) on near-white background
 * Outer rim: 4px gun-metal ring with #00D4FF inner glow (12px blur)
 * Hub: 40px brushed-aluminum circle with 0.5px shadow, cyan glow
 * Radial gradient background (#F9FBFD → #FFFFFF)
 */

interface SpokeConfig {
  name: string;
  route: string;
  angle: number;
  color: string;
}

// 8 spokes at 45° intervals (equidistant) with unique colors
const spokes: SpokeConfig[] = [
  { name: 'Stories', route: '/stories', angle: 0, color: '#FF4FA4' },
  { name: 'Mutuals', route: '/mutuals', angle: 45, color: '#00F5FF' },
  { name: 'Insights', route: '/insights', angle: 90, color: '#FFD400' },
  { name: 'Events', route: '/events', angle: 135, color: '#FF6B2D' },
  { name: 'Opportunities', route: '/opportunities', angle: 180, color: '#00FF87' },
  { name: 'Messages', route: '/messages', angle: 225, color: '#AE6DFF' },
  { name: 'My Network', route: '/network', angle: 270, color: '#FF4D4D' },
  { name: 'Resources', route: '/resources', angle: 315, color: '#39FFDC' },
];



const VIEWBOX_SIZE = 600;
const CENTER = VIEWBOX_SIZE / 2;
const HUB_RADIUS = 40;
const RIM_RADIUS = 260;
const SPOKE_END_RADIUS = 240;
const TARGET_NODE_RADIUS = 20;

const ACCENT_COLOR = '#00D4FF';
const ACCENT_GLOW = '#00FFFF';
const GUNMETAL = '#2C3539';
const MATTE_BLACK = '#1A1A1A';
const ALUMINUM = '#D4D4D8';
const ALUMINUM_DARK = '#A1A1AA';

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function getAngleFromCenter(clientX: number, clientY: number, svgRect: DOMRect, svgElement: SVGSVGElement): number {
  const point = svgElement.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svgElement.getScreenCTM();
  if (!ctm) return 0;
  const svgPoint = point.matrixTransform(ctm.inverse());
  
  const dx = svgPoint.x - CENTER;
  const dy = svgPoint.y - CENTER;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

export const NavigationWheel: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.getCurrentUser());
  const { user } = useAuth();
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  
  // Notification counts for spokes
  const [newStoriesCount, setNewStoriesCount] = useState<number>(0);
  const [newOpportunitiesCount, setNewOpportunitiesCount] = useState<number>(0);
  
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const targetRefs = useRef<(SVGGElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStartAngle = useRef<number>(0);
  const rotationAtDragStart = useRef<number>(0);
  const lastDragAngle = useRef<number>(0);
  const velocity = useRef<number>(0);
  const animationFrameId = useRef<number>(0);
  const dragStartTime = useRef<number>(0);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Fetch profile avatar from database
  useEffect(() => {
    const fetchProfileAvatar = async () => {
      if (!user?.id) {
        setProfileAvatarUrl(null);
        return;
      }
      
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setProfileAvatarUrl(data.avatar_url);
      }
    };
    
    fetchProfileAvatar();
  }, [user?.id]);

  // Simulate checking for new stories and opportunities
  // In production, this would fetch from the database
  useEffect(() => {
    if (user?.id) {
      // Placeholder: simulate new content notifications
      // Replace with actual database queries when tables exist
      setNewStoriesCount(3); // Example: 3 new stories
      setNewOpportunitiesCount(2); // Example: 2 new opportunities
    } else {
      setNewStoriesCount(0);
      setNewOpportunitiesCount(0);
    }
  }, [user?.id]);

  // Get notification count for a spoke
  const getNotificationCount = (spokeName: string): number => {
    if (spokeName === 'Stories') return newStoriesCount;
    if (spokeName === 'Opportunities') return newOpportunitiesCount;
    return 0;
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  // 60fps hardware-accelerated inertia
  const animateInertia = useCallback(() => {
    if (prefersReducedMotion) return;
    
    const decay = 0.95;
    const minVelocity = 0.1;
    
    if (Math.abs(velocity.current) > minVelocity) {
      setRotation(prev => prev + velocity.current);
      velocity.current *= decay;
      animationFrameId.current = requestAnimationFrame(animateInertia);
    }
  }, [prefersReducedMotion]);
  
  const stopAnimation = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = 0;
    }
    velocity.current = 0;
  }, []);
  
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return;
    
    stopAnimation();
    
    const rect = svgRef.current.getBoundingClientRect();
    const angle = getAngleFromCenter(clientX, clientY, rect, svgRef.current);
    
    dragStartAngle.current = angle;
    rotationAtDragStart.current = rotation;
    lastDragAngle.current = angle;
    dragStartTime.current = Date.now();
    dragStartPos.current = { x: clientX, y: clientY };
    velocity.current = 0;
    setIsDragging(true);
  }, [rotation, stopAnimation]);
  
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const currentAngle = getAngleFromCenter(clientX, clientY, rect, svgRef.current);
    
    let deltaAngle = currentAngle - dragStartAngle.current;
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    
    const angleDiff = currentAngle - lastDragAngle.current;
    let normalizedDiff = angleDiff;
    if (normalizedDiff > 180) normalizedDiff -= 360;
    if (normalizedDiff < -180) normalizedDiff += 360;
    velocity.current = normalizedDiff * 0.2;
    
    lastDragAngle.current = currentAngle;
    setRotation(rotationAtDragStart.current + deltaAngle);
  }, [isDragging]);
  
  const handleDragEnd = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    const duration = Date.now() - dragStartTime.current;
    const dx = clientX - dragStartPos.current.x;
    const dy = clientY - dragStartPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (duration < 200 && distance < 5) {
      velocity.current = 0;
      return;
    }
    
    if (!prefersReducedMotion && Math.abs(velocity.current) > 0.1) {
      animationFrameId.current = requestAnimationFrame(animateInertia);
    }
  }, [isDragging, prefersReducedMotion, animateInertia]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.closest('[role="button"]')) return;
    
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  }, [handleDragMove]);
  
  const handleMouseUp = useCallback((e: MouseEvent) => {
    handleDragEnd(e.clientX, e.clientY);
  }, [handleDragEnd]);
  
  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (target.closest('[role="button"]')) return;
    
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  }, [handleDragStart]);
  
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  }, [isDragging, handleDragMove]);
  
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0];
    handleDragEnd(touch.clientX, touch.clientY);
  }, [handleDragEnd]);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);
  
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
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
  
  const handleSpokeClick = (route: string) => {
    if (route) navigate(route);
  };

  // Spoke opacity based on drag state
  const spokeOpacity = isDragging ? 0.4 : 1;
  
  return (
    <div 
      className="relative flex flex-col items-center justify-center w-full h-full min-h-screen"
      style={{ 
        background: 'radial-gradient(circle at center, #F9FBFD 0%, #FFFFFF 100%)'
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Inlight Branding */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <img 
          src={inlightLogo} 
          alt="Inlight" 
          className="h-16 w-auto object-contain"
        />
        <span 
          className="text-2xl font-light tracking-[0.3em] uppercase"
          style={{ color: GUNMETAL }}
        >
          Inlight
        </span>
      </div>

      {/* Navigation Wheel */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className={`w-full h-full max-w-[500px] max-h-[500px] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        role="navigation"
        aria-label="Main navigation wheel"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ 
          touchAction: 'none',
          willChange: 'transform',
        }}
      >
        <defs>
          {/* Cyan glow filter for rim */}
          <filter id="rim-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feFlood floodColor={isDragging ? ACCENT_GLOW : ACCENT_COLOR} floodOpacity="0.6" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Hub glow filter */}
          <filter id="hub-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor={ACCENT_COLOR} floodOpacity="0.4" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Hub shadow */}
          <filter id="hub-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodColor="#000" floodOpacity="0.15" />
          </filter>
          
          {/* Brushed aluminum gradient */}
          <linearGradient id="aluminum-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E4E4E7" />
            <stop offset="25%" stopColor="#FAFAFA" />
            <stop offset="50%" stopColor="#D4D4D8" />
            <stop offset="75%" stopColor="#F4F4F5" />
            <stop offset="100%" stopColor="#A1A1AA" />
          </linearGradient>
          
          {/* Node glow on hover */}
          <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor={ACCENT_COLOR} floodOpacity="0.8" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Avatar clip path */}
          <clipPath id="avatarClip">
            <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS - 4} />
          </clipPath>
        </defs>
        
        {/* Outer rim with glow */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RIM_RADIUS}
          fill="none"
          stroke={GUNMETAL}
          strokeWidth={4}
          filter="url(#rim-glow)"
          style={{
            transition: isDragging ? 'none' : 'filter 0.3s ease',
          }}
        />
        
        {/* Rotatable wheel group */}
        <g 
          style={{ 
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CENTER}px ${CENTER}px`,
            willChange: 'transform',
          }}
        >
          {/* 12 ultra-thin spokes */}
          {spokes.map((spoke, index) => {
            const startPoint = polarToCartesian(CENTER, CENTER, HUB_RADIUS + 10, spoke.angle);
            const endPoint = polarToCartesian(CENTER, CENTER, RIM_RADIUS - 30, spoke.angle);
            
            return (
              <line
                key={`spoke-line-${index}`}
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={MATTE_BLACK}
                strokeWidth={2}
                strokeLinecap="round"
                style={{
                  opacity: spokeOpacity,
                  transition: 'opacity 0.2s ease',
                }}
              />
            );
          })}
          
          {/* Target nodes */}
          {spokes.map((spoke, index) => {
            const position = polarToCartesian(CENTER, CENTER, SPOKE_END_RADIUS, spoke.angle);
            const isHovered = hoveredIndex === index;
            const isFocused = focusedIndex === index;
            const notificationCount = getNotificationCount(spoke.name);
            
            // Position for notification badge (upper-right of the circle)
            const badgeOffset = TARGET_NODE_RADIUS * 0.7;
            const badgeX = position.x + badgeOffset;
            const badgeY = position.y - badgeOffset;
            
            return (
              <g
                key={`target-${index}`}
                ref={(el) => (targetRefs.current[index] = el)}
                role="button"
                aria-label={`Open ${spoke.name}${notificationCount > 0 ? `, ${notificationCount} new` : ''}`}
                tabIndex={0}
                onClick={() => handleSpokeClick(spoke.route)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(-1)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => setFocusedIndex(-1)}
                style={{
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {/* Hit area */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={TARGET_NODE_RADIUS + 12}
                  fill="transparent"
                />
                
                {/* Focus ring */}
                {isFocused && (
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={TARGET_NODE_RADIUS + 4}
                    fill="none"
                    stroke={ACCENT_COLOR}
                    strokeWidth={2}
                  />
                )}
                
                {/* Cyan glow ring around each node */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={TARGET_NODE_RADIUS + 3}
                  fill="none"
                  stroke={ACCENT_COLOR}
                  strokeWidth={1.5}
                  opacity={0.7}
                  filter="url(#node-glow)"
                />
                
                {/* Target node - colored */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={TARGET_NODE_RADIUS}
                  fill={spoke.color}
                  style={{
                    transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
                    transformOrigin: `${position.x}px ${position.y}px`,
                    transform: isHovered && !prefersReducedMotion ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
                
                {/* Label - counter-rotate to keep upright */}
                <g style={{ 
                  transform: `rotate(${-rotation}deg)`,
                  transformOrigin: `${position.x}px ${position.y}px`,
                }}>
                  <text
                    x={position.x}
                    y={position.y + TARGET_NODE_RADIUS + 18}
                    textAnchor="middle"
                    fill={GUNMETAL}
                    fontSize="11"
                    fontWeight="500"
                    letterSpacing="0.05em"
                    style={{ pointerEvents: 'none' }}
                  >
                    {spoke.name}
                  </text>
                </g>
                
                {/* Notification badge - counter-rotate to keep upright */}
                {notificationCount > 0 && (
                  <g style={{ 
                    transform: `rotate(${-rotation}deg)`,
                    transformOrigin: `${position.x}px ${position.y}px`,
                  }}>
                    {/* Badge background */}
                    <circle
                      cx={badgeX}
                      cy={badgeY}
                      r={10}
                      fill="#FF3B30"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    {/* Badge count */}
                    <text
                      x={badgeX}
                      y={badgeY + 4}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="700"
                      style={{ pointerEvents: 'none' }}
                    >
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
        
        {/* Center hub - brushed aluminum with cyan glow */}
        <g
          role="button"
          aria-label="Open your profile"
          tabIndex={0}
          onClick={handleHubClick}
          onKeyDown={(e) => e.key === 'Enter' && handleHubClick()}
          style={{ cursor: 'pointer', outline: 'none' }}
          className="group"
        >
          {/* Hub background - brushed aluminum */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            fill="url(#aluminum-gradient)"
            filter="url(#hub-shadow)"
          />
          
          {/* Hub glow ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS + 2}
            fill="none"
            stroke={ACCENT_COLOR}
            strokeWidth={1}
            opacity={0.6}
            filter="url(#hub-glow)"
          />
          
          {/* Avatar - prioritize database avatar, fallback to store */}
          {(profileAvatarUrl || currentUser?.avatar) && (
            <image
              href={profileAvatarUrl || currentUser?.avatar}
              x={CENTER - (HUB_RADIUS - 4)}
              y={CENTER - (HUB_RADIUS - 4)}
              width={(HUB_RADIUS - 4) * 2}
              height={(HUB_RADIUS - 4) * 2}
              clipPath="url(#avatarClip)"
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          
          {/* Hover effect */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={HUB_RADIUS}
            fill="transparent"
            className="transition-colors duration-200"
            style={{
              fill: 'transparent',
            }}
          />
        </g>
      </svg>
    </div>
  );
};

export default NavigationWheel;
