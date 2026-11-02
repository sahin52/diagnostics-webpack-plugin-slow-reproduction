
import { useEffect, useState, type ReactNode } from 'react';
import './comp-36.scss';

export interface Comp36Props { title: string; url: string; children?: ReactNode; onLoaded?: (items: { id: number }[]) => void }

export function Comp36({ title, url, children, onLoaded }: Comp36Props) {
  const [items, setItems] = useState<{ id: number }[]>([]);
  useEffect(() => {
    void fetch(url).then(r => r.json()).then((data: unknown[]) => {
      const loaded = data.map((x, index) => ({ id: index, ...(x as object) }));
      setItems(loaded);
      onLoaded?.(loaded);
    });
  }, [url, onLoaded]);
  return <div className="comp-36"><h2 className="comp-36__title">{title}</h2>{items.map(x => <span key={x.id}>{x.id}</span>)}{children}</div>;
}
