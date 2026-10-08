import { useState, useRef, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Lock, KeyRound, Eye, EyeOff } from 'lucide-react';

const PASSWORD = '091004';

interface PasswordGateProps {
  onUnlock: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() === PASSWORD) {
      setError(false);
      onUnlock();
      return;
    }
    setError(true);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full min-h-screen bg-[#4a3b2c] flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="paper-texture paper-grain botanical-corner-tl botanical-corner-br relative rounded-sm px-7 pt-10 pb-8 text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#cba72f]/50 bg-[#4a3b2c]/10">
            <Lock className="h-6 w-6 text-[#8b7346]" strokeWidth={1.5} />
          </div>

          <h1 className="font-serif-display text-2xl text-[#3a2c1e] tracking-wide">
            Nuestra historia juntos
          </h1>

          <div className="botanical-divider my-3">❦</div>

          <p className="font-sans-ui text-sm text-[#6b5b45] leading-relaxed">
            Este álbum es solo nuestro. Ingresa la contraseña para abrirlo.
          </p>

          <motion.form
            onSubmit={handleSubmit}
            animate={error ? { x: [0, -10, 10, -7, 7, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-6 space-y-3"
          >
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b7346]"
                strokeWidth={1.5}
              />
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                autoFocus
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="••••••"
                aria-label="Contraseña"
                className={`w-full rounded-sm border bg-[#fdfaf2]/80 py-3 pl-9 pr-10 font-sans-ui tracking-[0.35em] text-center text-[#3a2c1e] placeholder:text-[#a8977b] outline-none transition ${
                  error
                    ? 'border-red-700/70 focus:border-red-700'
                    : 'border-[#8b7346]/40 focus:border-[#cba72f]'
                } focus:ring-2 focus:ring-[#cba72f]/30`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7346] transition hover:text-[#3a2c1e]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-sans-ui text-xs font-medium text-red-800"
              >
                Contraseña incorrecta. Inténtalo de nuevo.
              </motion.p>
            )}

            <button
              type="submit"
              className="w-full rounded-sm bg-[#4a3b2c] py-3 font-sans-ui text-sm uppercase tracking-[0.25em] text-[#f6f1e3] shadow-md transition hover:bg-[#3a2c1e] active:translate-y-px"
            >
              Abrir álbum
            </button>
          </motion.form>
        </div>

        <p className="mt-4 text-center font-handwriting text-lg text-[#d4af37]/70">
          Hecho con amor para nosotros dos
        </p>
      </motion.div>
    </div>
  );
};
