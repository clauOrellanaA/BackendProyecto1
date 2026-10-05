import { ApiResponse } from "@nestjs/swagger";
import { responseSchemas } from "../common/docs/response-schemas";
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ReportQueryDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

// Reportes de gestion: solo el administrador
@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_dashboard })
  @ApiOperation({ summary: 'Tablero general: conteos del sistema y estado del periodo abierto' })
  @Get('dashboard')
  dashboard() {
    return this.reportsService.dashboard();
  }

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_enrollmentsByProgram })
  @ApiOperation({ summary: 'Matriculas y estudiantes por programa en un periodo' })
  @Get('enrollments-by-program')
  enrollmentsByProgram(@Query() query: ReportQueryDto) {
    return this.reportsService.enrollmentsByProgram(query);
  }

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_groupOccupancy })
  @ApiOperation({ summary: 'Ocupacion de los grupos (los mas llenos primero)' })
  @Get('group-occupancy')
  groupOccupancy(@Query() query: ReportQueryDto) {
    return this.reportsService.groupOccupancy(query);
  }

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_subjectPerformance })
  @ApiOperation({ summary: 'Aprobacion y promedio por materia (las de menor aprobacion primero)' })
  @Get('subject-performance')
  subjectPerformance(@Query() query: ReportQueryDto) {
    return this.reportsService.subjectPerformance(query);
  }

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_topStudents })
  @ApiOperation({ summary: 'Mejores promedios del periodo (ponderados por creditos)' })
  @Get('top-students')
  topStudents(@Query() query: ReportQueryDto) {
    return this.reportsService.topStudents(query);
  }

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_atRiskStudents })
  @ApiOperation({ summary: 'Estudiantes con materias reprobadas en el periodo' })
  @Get('at-risk-students')
  atRiskStudents(@Query() query: ReportQueryDto) {
    return this.reportsService.atRiskStudents(query);
  }

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_teacherLoad })
  @ApiOperation({ summary: 'Carga docente: grupos, estudiantes y creditos por docente' })
  @Get('teacher-load')
  teacherLoad(@Query() query: ReportQueryDto) {
    return this.reportsService.teacherLoad(query);
  }

  @ApiResponse({ status: 200, schema: responseSchemas.ReportsController_facultySummary })
  @ApiOperation({ summary: 'Programas, docentes y estudiantes por facultad' })
  @Get('faculty-summary')
  facultySummary() {
    return this.reportsService.facultySummary();
  }
}
