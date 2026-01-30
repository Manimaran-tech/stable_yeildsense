import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
    children: React.ReactNode;
    className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className = '' }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

// Modal transition wrapper
interface ModalTransitionProps {
    children: React.ReactNode;
    isOpen: boolean;
    className?: string;
}

export const ModalTransition: React.FC<ModalTransitionProps> = ({ children, isOpen, className = '' }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

// Backdrop overlay animation
export const BackdropTransition: React.FC<{ isOpen: boolean; onClick?: () => void; className?: string }> = ({
    isOpen,
    onClick,
    className = ''
}) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 ${className}`}
        />
    );
};

export default PageTransition;
