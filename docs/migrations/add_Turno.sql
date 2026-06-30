USE [GEMA];
GO -- 1. Crear la tabla de catálogo cat.Turno
    CREATE TABLE [cat].[Turno](
        [TurnoID] [int] IDENTITY(1, 1) NOT NULL,
        [Codigo] [nvarchar](5) NOT NULL,
        [Descripcion] [nvarchar](50) NOT NULL,
        [FechaRegistro] [datetime] NOT NULL DEFAULT (getdate()),
        CONSTRAINT [PK_Turno] PRIMARY KEY CLUSTERED ([TurnoID] ASC),
        CONSTRAINT [UQ_Turno_Codigo] UNIQUE NONCLUSTERED ([Codigo] ASC)
    ) ON [PRIMARY];
GO -- 2. Poblar los turnos estándar
INSERT INTO [cat].[Turno] (Codigo, Descripcion)
VALUES ('D', 'Día / Day Shift');
INSERT INTO [cat].[Turno] (Codigo, Descripcion)
VALUES ('N', 'Noche / Night Shift');
GO -- 3. Crear la relación de clave foránea en dbo.Sondajes
ALTER TABLE [dbo].[Sondajes]
ADD [TurnoID] INT NULL;
GO
ALTER TABLE [dbo].[Sondajes] WITH CHECK
ADD CONSTRAINT [FK_Sondajes_Turno] FOREIGN KEY([TurnoID]) REFERENCES [cat].[Turno] ([TurnoID]);
GO
ALTER TABLE [dbo].[Sondajes] CHECK CONSTRAINT [FK_Sondajes_Turno];
GO -- Agregando este, norte, cota, profundidad proyectados
ALTER TABLE dbo.Collar
ADD CoordenadaEsteProyectado NUMERIC(12, 3) NULL;
ALTER TABLE dbo.Collar
ADD CoordenadaNorteProyectado NUMERIC(12, 3) NULL;
ALTER TABLE dbo.Collar
ADD ElevacionProyectado NUMERIC(10, 3) NULL;
ALTER TABLE dbo.Collar
ADD ProfundidadTotalProyectada NUMERIC(10, 2) NULL;
ALTER TABLE dbo.Collar
ADD ComentariosProyectado VARCHAR(500) NULL;
ALTER TABLE dbo.Collar
ADD Comentarios VARCHAR(500) NULL;