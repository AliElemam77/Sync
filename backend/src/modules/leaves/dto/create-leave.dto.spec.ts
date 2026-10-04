import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLeaveDto } from './create-leave.dto';

describe('CreateLeaveDto', () => {
  const errorsFor = async (type: string) =>
    validate(plainToInstance(CreateLeaveDto, { startDate: '2026-10-06', endDate: '2026-10-06', type }));

  it('accepts annual, sick and maternity leave', async () => {
    for (const type of ['ANNUAL', 'SICK', 'MATERNITY']) {
      expect(await errorsFor(type)).toHaveLength(0);
    }
  });

  it('rejects unpaid leave, which the company does not offer', async () => {
    const errors = await errorsFor('UNPAID');
    expect(errors.map((e) => e.property)).toEqual(['type']);
  });
});
