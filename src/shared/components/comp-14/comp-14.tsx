
import { useEffect, useState, type ReactNode } from 'react';
import './comp-14.scss';

export interface Comp14Props { title: string; url: string; children?: ReactNode; onLoaded?: (items: { id: number }[]) => void }

export function Comp14({ title, url, children, onLoaded }: Comp14Props) {
  const [items, setItems] = useState<{ id: number }[]>([]);
  useEffect(() => {
    void fetch(url).then(r => r.json()).then((data: unknown[]) => {
      const loaded = data.map((x, index) => ({ id: index, ...(x as object) }));
      setItems(loaded);
      onLoaded?.(loaded);
    });
  }, [url, onLoaded]);
  return <div className="comp-14"><h2 className="comp-14__title">{title}</h2>{items.map(x => <span key={x.id}>{x.id}</span>)}{children}</div>;
}
