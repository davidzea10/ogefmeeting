import { cn } from '@/lib/cn';
import { Eye, EyeOff } from 'lucide-react';
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
} from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, id, required, type, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const describedBy = [error ? errorId : null, !error && hint ? hintId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
          {required && (
            <span className="text-danger" aria-hidden>
              {' '}
              *
            </span>
          )}
          {required && <span className="sr-only"> (obligatoire)</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          required={required}
          className={cn(
            'min-h-11 h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-text',
            'placeholder:text-text-muted',
            'transition-colors duration-200',
            'hover:border-border-strong',
            'focus:border-ogefrem-blue focus:outline-none focus:ring-2 focus:ring-ogefrem-blue/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isPassword && 'pr-11',
            error && 'border-danger focus:border-danger focus:ring-danger/25',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center rounded-r-lg text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ogefrem-blue"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
