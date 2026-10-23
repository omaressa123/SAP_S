import { useCallback } from 'react'

const STEPS = [
  { id: 1, label: 'Face ID', icon: 'fingerprint' },
  { id: 2, label: 'Bag Count', icon: 'luggage' },
  { id: 3, label: 'Weigh & Scale', icon: 'scale' },
  { id: 4, label: 'Print & Tag', icon: 'print' },
  { id: 5, label: 'Optical Verify', icon: 'qr_code_scanner' },
  { id: 6, label: 'Complete', icon: 'task_alt' },
]

export default function Stepper({ currentStep, completedSteps, onStepClick }) {
  const handleClick = useCallback(
    (id) => () => {
      onStepClick(id)
    },
    [onStepClick]
  )

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0" id="stepperNav">
      {STEPS.map((step) => {
        const isActive = currentStep === step.id
        const isCompleted = completedSteps.includes(step.id)
        const isPending = !isActive && !isCompleted
        return (
          <button
            key={step.id}
            type="button"
            className={`step-btn px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 transition-all ${
              isActive
                ? 'bg-primary text-on-primary shadow-sm'
                : isCompleted
                ? 'bg-secondary-fixed text-on-secondary-fixed font-bold'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
            onClick={handleClick(step.id)}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold">
              {step.id}
            </span>
            <span>{step.label}</span>
          </button>
        )
      })}
    </div>
  )
}
