import { ForbiddenException } from '@nestjs/common';
import { VentasPresencialesService } from './ventas-presenciales.service';

describe('VentasPresencialesService asignaciones', () => {
  it('no guarda la venta ni descuenta stock si la asignación ya no está activa', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn().mockResolvedValue({
          Id: 2,
          Codigo: 'POS_FUNA_UNA',
          Nombre: 'FUNA-UNA',
          Activo: true,
        }),
        save: jest.fn(),
      },
    };
    const asignaciones = {
      listarPuntosOperables: jest.fn(),
      exigirVentaEnPunto: jest.fn().mockRejectedValue(
        new ForbiddenException('No tienes una asignación activa para este punto de venta.'),
      ),
    };
    const service = new VentasPresencialesService(
      { createQueryRunner: () => queryRunner } as never,
      { enviarComprobanteVentaFisica: jest.fn() } as never,
      asignaciones as never,
    );

    await expect(
      service.registrar(
        { ubicacionCodigo: 'POS_FUNA_UNA', items: [{ productoId: '1', cantidad: 1 }] },
        7,
        ['Vendedor'],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(asignaciones.exigirVentaEnPunto).toHaveBeenCalledWith(
      7,
      ['Vendedor'],
      expect.objectContaining({ Codigo: 'POS_FUNA_UNA' }),
      queryRunner.manager,
    );
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });
});
