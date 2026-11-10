import { ReactNode, useEffect, useState } from 'react';

export function LiveClock({ render }: { render: (now: Date) => ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{render(now)}</>;
}
