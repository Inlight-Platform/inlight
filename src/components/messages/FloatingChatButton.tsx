import React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingChatButtonProps {
  onClick: () => void;
}

const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick }) => {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all md:bottom-6 md:right-6"
    >
      <Mail className="w-6 h-6" />
    </Button>
  );
};

export default FloatingChatButton;
