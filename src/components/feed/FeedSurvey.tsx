import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type FeedSurveyAnswers = {
  role: string;
  school: string;
  goal: string;
};

const ROLES = ['Actor', 'Director', 'Songwriter', 'Producer', 'Dancer', 'Composer', 'Writer', 'Designer'];
const SCHOOLS = ['NYU Tisch', 'Juilliard', 'USC SCA', 'Berklee', 'Yale Drama', 'CalArts', 'AFI', 'Other'];
const GOALS = [
  'Finding Crew',
  'Professional Networking',
  'Funding Projects',
  'Booking Auditions',
  'Releasing Music',
];

const STEPS = [
  { key: 'role' as const, title: "What's your role in the industry?", options: ROLES },
  { key: 'school' as const, title: 'Where did you study?', options: SCHOOLS },
  { key: 'goal' as const, title: 'What do you want to move forward?', options: GOALS },
];

interface FeedSurveyProps {
  onComplete?: (answers: FeedSurveyAnswers) => void;
  isSaving?: boolean;
}

export const FeedSurvey: React.FC<FeedSurveyProps> = ({ onComplete, isSaving = false }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<FeedSurveyAnswers>>({});
  const current = STEPS[step];

  const handlePick = (value: string) => {
    if (isSaving) return;

    const nextAnswers = { ...answers, [current.key]: value };
    setAnswers(nextAnswers);

    if (step < STEPS.length - 1) {
      window.setTimeout(() => setStep((currentStep) => currentStep + 1), 180);
      return;
    }

    const complete = nextAnswers as FeedSurveyAnswers;
    window.setTimeout(() => onComplete?.(complete), 220);
  };

  return (
    <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {isSaving ? 'Saving' : `Step ${step + 1} of ${STEPS.length}`}
              </p>
              <h2 className="text-xl font-semibold leading-snug">
                {isSaving ? 'Tuning your feed...' : current.title}
              </h2>
            </div>
          </div>

          <div className="hidden items-center gap-1 sm:flex" aria-hidden="true">
            {STEPS.map((surveyStep, index) => (
              <span
                key={surveyStep.key}
                className={`h-1.5 rounded-full transition-all ${
                  index === step ? 'w-8 bg-primary' : index < step ? 'w-4 bg-primary/70' : 'w-4 bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {current.options.map((option) => {
            const selected = answers[current.key] === option;

            return (
              <Button
                key={option}
                type="button"
                variant={selected ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePick(option)}
                disabled={isSaving}
                className="rounded-full"
              >
                {isSaving && selected && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {option}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
