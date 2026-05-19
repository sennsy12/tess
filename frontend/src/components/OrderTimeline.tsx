import type { OrderDetail } from '../types/order';

interface OrderTimelineProps {
  order: OrderDetail;
}

/** Visual order progress from available order/line fields. */
export function OrderTimeline({ order }: OrderTimelineProps) {
  const activeLines = order.lines.filter((l) => l.linjestatus === 1).length;
  const totalLines = order.lines.length;
  const hasRefs = order.lines.some(
    (l) => l.henvisning1 || l.henvisning2 || l.henvisning3,
  );

  const steps = [
    {
      id: 'registered',
      label: 'Ordre registrert',
      detail: new Date(order.dato).toLocaleDateString('nb-NO'),
      done: true,
    },
    {
      id: 'lines',
      label: 'Ordrelinjer',
      detail: `${activeLines} av ${totalLines} aktive linjer`,
      done: totalLines > 0,
    },
    {
      id: 'refs',
      label: 'Referanser',
      detail: hasRefs ? 'Henvisninger registrert' : 'Ingen henvisninger',
      done: hasRefs || Boolean(order.kunderef || order.kundeordreref),
    },
    {
      id: 'complete',
      label: 'Ordre fullført',
      detail: new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: order.valutaid || 'NOK',
      }).format(order.sum),
      done: order.sum > 0 && activeLines === totalLines && totalLines > 0,
    },
  ];

  return (
    <ol className="space-y-0" aria-label="Ordrestatus">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                step.done
                  ? 'bg-green-600/30 text-green-300 ring-2 ring-green-600/50'
                  : 'bg-dark-800 text-dark-500 ring-2 ring-dark-700'
              }`}
              aria-hidden
            >
              {step.done ? '✓' : index + 1}
            </span>
            {index < steps.length - 1 && (
              <span className={`w-0.5 flex-1 min-h-[2rem] ${step.done ? 'bg-green-700/50' : 'bg-dark-700'}`} />
            )}
          </div>
          <div className="pb-6 min-w-0">
            <p className={`font-medium ${step.done ? 'text-dark-100' : 'text-dark-400'}`}>{step.label}</p>
            <p className="text-sm text-dark-400 mt-0.5">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
