import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

interface MappedPrismaError {
  statusCode: HttpStatus;
  error: string;
  message: string;
}

export function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): MappedPrismaError {
  switch (exception.code) {
    // Unique constraint (e.g. duplicate email, department code, concurrent check-in)
    case 'P2002': {
      const target = exception.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : target;
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: fields
          ? `A record with the same ${fields} already exists.`
          : 'A record with the same unique value already exists.',
      };
    }
    // Foreign key (deleting a record still referenced elsewhere, or referencing a missing one)
    case 'P2003':
    case 'P2014':
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'This operation conflicts with related records.',
      };
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'The requested record was not found.',
      };
    // Malformed value for the column type (e.g. a non-UUID id) or value too long
    case 'P2023':
    case 'P2000':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'One or more provided values are invalid.',
      };
    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Internal server error',
      };
  }
}

// HTTP only: registered with app.useGlobalFilters, which does not apply to WebSocket gateways
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = mapPrismaError(exception);

    if (mapped.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.stack);
    }

    host.switchToHttp().getResponse<Response>().status(mapped.statusCode).json(mapped);
  }
}
