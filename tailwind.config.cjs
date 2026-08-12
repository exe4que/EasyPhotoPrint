module.exports = {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      keyframes: {
        // Flashes an amber glow around an element and back to nothing, with the intermediate
        // stops (overshoot, undershoot, small rebound) baked directly into the keyframe
        // percentages -- CSS has no built-in "bounce" timing-function, so the bounce comes from
        // this decaying-oscillation shape rather than from `animation-timing-function` alone.
        'flash-amber': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(251 191 36 / 0)' },
          '40%': { boxShadow: '0 0 0 4px rgb(251 191 36 / 0.9)' },
          '55%': { boxShadow: '0 0 0 2px rgb(251 191 36 / 0.5)' },
          '75%': { boxShadow: '0 0 0 3px rgb(251 191 36 / 0.75)' },
        },
      },
      animation: {
        'flash-amber': 'flash-amber 1.1s ease-in-out 1',
      },
    },
  },
  plugins: [],
};
