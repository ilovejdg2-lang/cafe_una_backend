import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ESTADOS_NECESIDAD, PRIORIDADES_NECESIDAD } from '../entities/donacion-necesidad.entity';

export class CreateNecesidadDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MaxLength(2000)
  descripcion: string;

  @IsIn([...PRIORIDADES_NECESIDAD], {
    message: 'La prioridad debe ser ALTA, MEDIA o BAJA.',
  })
  prioridad: (typeof PRIORIDADES_NECESIDAD)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidadRequerida?: number | null;
}

export class UpdateNecesidadDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El título no puede quedar vacío.' })
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La descripción no puede quedar vacía.' })
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsIn([...PRIORIDADES_NECESIDAD], {
    message: 'La prioridad debe ser ALTA, MEDIA o BAJA.',
  })
  prioridad?: (typeof PRIORIDADES_NECESIDAD)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidadRequerida?: number | null;

  @IsOptional()
  @IsIn([...ESTADOS_NECESIDAD], {
    message: 'El estado debe ser ACTIVA o INACTIVA.',
  })
  estado?: (typeof ESTADOS_NECESIDAD)[number];
}
