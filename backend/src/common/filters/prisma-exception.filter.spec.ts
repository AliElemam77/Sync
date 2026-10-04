import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter, mapPrismaError } from './prisma-exception.filter';

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('prisma failure', {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta,
  });

describe('mapPrismaError', () => {
  it('maps unique violations to 409 and names the fields', () => {
    expect(mapPrismaError(prismaError('P2002', { target: ['email'] }))).toEqual({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'A record with the same email already exists.',
    });
  });

  it('maps foreign key violations to 409', () => {
    expect(mapPrismaError(prismaError('P2003')).statusCode).toBe(HttpStatus.CONFLICT);
  });

  it('maps missing records to 404', () => {
    expect(mapPrismaError(prismaError('P2025')).statusCode).toBe(HttpStatus.NOT_FOUND);
  });

  it('maps malformed values to 400', () => {
    expect(mapPrismaError(prismaError('P2023')).statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('keeps unknown codes as 500 without leaking details', () => {
    expect(mapPrismaError(prismaError('P1001'))).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });
});

describe('PrismaExceptionFilter', () => {
  it('writes the mapped status and body to the HTTP response', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new PrismaExceptionFilter().catch(prismaError('P2025'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: HttpStatus.NOT_FOUND }));
  });
});
