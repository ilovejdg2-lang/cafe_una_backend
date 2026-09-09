import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ESTADOS_NECESIDAD } from '../entities/donacion-necesidad.entity';

export class CreateMaterialAceptadoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del material es obligatorio.' })
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}

export class UpdateMaterialAceptadoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del material no puede quedar vacío.' })
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsIn([...ESTADOS_NECESIDAD], {
    message: 'El estado debe ser ACTIVA o INACTIVA.',
  })
  estado?: (typeof ESTADOS_NECESIDAD)[number];
}
