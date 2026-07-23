"use client";

import React, { useRef, useState } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  isUpdating?: boolean;
}

export default function GlassCard({ children, className = "", isUpdating = false, ...props }: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate percentage for glare
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    setGlarePosition({ x: xPercent, y: yPercent });

    // Calculate rotation (-2 to 2 degrees)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -3; 
    const rotateY = ((x - centerX) / centerX) * 3;  

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!cardRef.current) return;
    // Reset transform on leave
    cardRef.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)";
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  // Extract liquid-glass-card from className to avoid duplicating it if someone passes it
  const finalClassName = `liquid-glass-card ${className.replace('liquid-glass-card', '')}`.trim();

  return (
    <div 
      ref={cardRef}
      className={finalClassName}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        transition: isHovered ? "box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease" : "all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)",
      }}
      {...props}
    >
      {/* Glare effect */}
      {isHovered && (
        <div 
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 60%)`,
            borderRadius: 'inherit'
          }}
        />
      )}
      
      {/* Data loading shimmer */}
      {isUpdating && (
        <div className="glass-shimmer-overlay" style={{ borderRadius: 'inherit' }} />
      )}
      
      {children}
    </div>
  );
}
