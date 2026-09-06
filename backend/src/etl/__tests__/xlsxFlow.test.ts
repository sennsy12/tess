import {
  assertSstBudget,
  createRowFlowController,
  XLSX_HIGH_WATER_ROWS,
  XLSX_LOW_WATER_ROWS,
  XLSX_MAX_SHARED_STRINGS,
  XLSX_MAX_SST_BYTES,
} from '../streaming/sources/xlsxSource';
import { ValidationError } from '../../middleware/errorHandler';

describe('createRowFlowController', () => {
  function setup() {
    const calls: Array<'pause' | 'resume'> = [];
    const flow = createRowFlowController({
      highWater: 4,
      lowWater: 1,
      pause: () => {
        calls.push('pause');
      },
      resume: () => {
        calls.push('resume');
      },
    });
    return { flow, calls };
  }

  it('pauser ved high water og resum-er først ved low water (ingen flapping)', () => {
    const { flow, calls } = setup();
    flow.onEnqueue(3);
    expect(flow.paused).toBe(false);
    flow.onEnqueue(4);
    expect(flow.paused).toBe(true);
    expect(calls).toEqual(['pause']);

    // Fortsatt mettet over low water: ingen nye kall.
    flow.onEnqueue(5);
    flow.onDequeue(3);
    flow.onDequeue(2);
    expect(flow.paused).toBe(true);
    expect(calls).toEqual(['pause']);

    flow.onDequeue(1);
    expect(flow.paused).toBe(false);
    expect(calls).toEqual(['pause', 'resume']);
  });

  it('release er idempotent og redder pauset stream', () => {
    const { flow, calls } = setup();
    flow.release();
    expect(calls).toEqual([]);

    flow.onEnqueue(4);
    flow.release();
    flow.release();
    expect(calls).toEqual(['pause', 'resume']);
    expect(flow.paused).toBe(false);
  });

  it('tåler kastende pause/resume (halvt nedrevet stream)', () => {
    const flow = createRowFlowController({
      highWater: 1,
      lowWater: 0,
      pause: () => {
        throw new Error('gone');
      },
      resume: () => {
        throw new Error('gone');
      },
    });
    expect(() => flow.onEnqueue(1)).not.toThrow();
    expect(flow.paused).toBe(true);
    expect(() => flow.onDequeue(0)).not.toThrow();
    expect(flow.paused).toBe(false);
  });

  it('eksponerer fornuftige produksjonsvannmerker', () => {
    expect(XLSX_HIGH_WATER_ROWS).toBeGreaterThan(XLSX_LOW_WATER_ROWS);
    expect(XLSX_LOW_WATER_ROWS).toBeGreaterThan(0);
  });
});

describe('assertSstBudget', () => {
  it('aksepterer innenfor grensene (inkl. eksakt grense)', () => {
    expect(() =>
      assertSstBudget({ byteLength: XLSX_MAX_SST_BYTES, stringCount: XLSX_MAX_SHARED_STRINGS })
    ).not.toThrow();
    expect(() => assertSstBudget({ byteLength: 0, stringCount: 0 })).not.toThrow();
  });

  it('feiler raskt med ValidationError over grensene', () => {
    expect(() =>
      assertSstBudget({ byteLength: XLSX_MAX_SST_BYTES + 1, stringCount: 0 })
    ).toThrow(ValidationError);
    expect(() =>
      assertSstBudget({ byteLength: 0, stringCount: XLSX_MAX_SHARED_STRINGS + 1 })
    ).toThrow(ValidationError);
  });
});
