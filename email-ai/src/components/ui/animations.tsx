import { motion, useInView, useScroll } from 'framer-motion';
import { useRef } from 'react';

// Magnetic Button Effect
export const MagneticButton = ({ 
  children, 
  className,
  onClick
}: { 
  children: React.ReactNode; 
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const { clientX, clientY } = e;
    const { left, top, width, height } = rect;
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    
    buttonRef.current?.style.setProperty('--translate-x', `${x * 0.1}px`);
    buttonRef.current?.style.setProperty('--translate-y', `${y * 0.1}px`);
  };

  const handleMouseLeave = () => {
    buttonRef.current?.style.setProperty('--translate-x', '0');
    buttonRef.current?.style.setProperty('--translate-y', '0');
  };

  return (
    <motion.button
      ref={buttonRef}
      className={`relative transform hover:scale-105 transition-transform ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: 'translate(var(--translate-x, 0), var(--translate-y, 0))',
      }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
};

// 3D Card Tilt Effect
export const TiltCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;

    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width;
    const y = (e.clientY - top) / height;
    
    const tiltX = (y - 0.5) * 20; // Max tilt of 20 degrees
    const tiltY = (x - 0.5) * -20;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <motion.div
      ref={cardRef}
      className={`transition-transform duration-200 ease-out ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      {children}
    </motion.div>
  );
};

// Text Reveal Animation
export const RevealText = ({ text, className }: { text: string; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const words = text.split(' ');

  const container = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.04 * i },
    }),
  };

  const child = {
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 100,
      },
    },
    hidden: {
      opacity: 0,
      y: 20,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={`overflow-hidden ${className}`}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={container}
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="inline-block mr-1"
          variants={child}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
};

// Morphing Background
export const MorphingBackground = () => {
  return (
    <motion.div
      className="absolute inset-0 -z-10"
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0.3, 0.5, 0.3],
        background: [
          'radial-gradient(circle at 0% 0%, #ff4d4d 0%, #ff9966 50%, #ffcc66 100%)',
          'radial-gradient(circle at 100% 100%, #ff6666 0%, #ff9966 50%, #ffcc66 100%)',
          'radial-gradient(circle at 0% 0%, #ff4d4d 0%, #ff9966 50%, #ffcc66 100%)',
        ],
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );
};

// Floating Elements
export const FloatingElement = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <motion.div
      className={className}
      animate={{
        y: [-10, 10],
        transition: {
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse" as const,
          ease: "easeInOut"
        }
      }}
      whileHover={{ scale: 1.05 }}
    >
      {children}
    </motion.div>
  );
};

// Glitch Effect
export const GlitchText = ({ text, className }: { text: string; className?: string }) => {
  return (
    <div className={`relative ${className}`}>
      <motion.span
        className="absolute top-0 left-0 text-red-500"
        animate={{
          x: [-2, 2, -2],
          opacity: [1, 0.8, 1],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute top-0 left-0 text-blue-500"
        animate={{
          x: [2, -2, 2],
          opacity: [1, 0.8, 1],
        }}
        transition={{
          duration: 0.2,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        {text}
      </motion.span>
      <span className="relative">{text}</span>
    </div>
  );
};

// Scroll Progress Indicator
export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-orange-500 origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  );
}; 