import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { Course } from "../models/Course";
import { Lesson } from "../models/Lesson";
import { slugify, uploadVideo } from "./upload-lesson";

// Sube los cursos de Bakano desde ~/Downloads a Bunny Stream y los publica.
// Es idempotente: si el curso o la clase ya existen (por slug) no se vuelven a subir,
// así que se puede correr de nuevo si se corta.
//
// Uso: pnpm upload:courses [carpeta-base]   (por defecto ~/Downloads)

type LessonEntry = { file: string; title: string };
type CourseEntry = {
  folder: string;
  slug: string;
  title: string;
  summary: string;
  lessons: LessonEntry[];
};

const COURSES: CourseEntry[] = [
  {
    folder: "estrategia comercial",
    slug: "estrategia-comercial",
    title: "Estrategia Comercial",
    summary:
      "Cómo definir el ticket de tu oferta: rangos de precio y cuándo conviene vender low, medium o high ticket.",
    lessons: [
      { file: "INTRODUCCIÓN ESTRATEGIA COMERCIAL.mp4", title: "Introducción a la estrategia comercial" },
      { file: "1.0 EL TICKET.mp4", title: "El ticket" },
      { file: "1.1 RANGOS DE TICKETS.mp4", title: "Rangos de tickets" },
      { file: "1.2 LOW TICKET.mp4", title: "Low ticket" },
      { file: "1.3 MEDIUM TICKET.mp4", title: "Medium ticket" },
      { file: "1.4 HIGH TICKET.mp4", title: "High ticket" },
      { file: "1.5 CONCLUSION TICKETS.mp4", title: "Conclusión: cómo elegir tu ticket" },
    ],
  },
  {
    folder: "adn de la venta",
    slug: "adn-de-la-venta",
    title: "ADN de la Venta: Método SPIN",
    summary:
      "El método SPIN aplicado a tu proceso comercial: mentalidad, dominio, neuromarketing y cada una de sus preguntas.",
    lessons: [
      { file: "1.0 METODO SPIN.mp4", title: "El método SPIN" },
      { file: "1.1 METODO SPIN - MENTALIDAD", title: "Mentalidad del vendedor" },
      { file: "1.2 METODO SPIN - DOMINIO.mp4", title: "Dominio de la conversación" },
      { file: "1.3 METODO SPIN - NEUROMARKETING", title: "Neuromarketing en la venta" },
      { file: "1.4 METODO SPIN - S", title: "S: preguntas de situación" },
      { file: "METODO SPIN LETRA P.mp4", title: "P: preguntas de problema" },
      { file: "METODO SPIN LETRA I.mp4", title: "I: preguntas de implicación" },
      { file: "METODO SPIN LETRA N.mp4", title: "N: preguntas de necesidad" },
      { file: "METODO SPIN FINAL.mp4", title: "Cierre del método SPIN" },
    ],
  },
  {
    folder: "marketing y ventas",
    slug: "marketing-y-ventas",
    title: "Marketing y Ventas",
    summary:
      "Qué hace el marketing, qué hace ventas y cómo conectarlos: embudo, comunicación, niveles de conciencia y seguimiento.",
    lessons: [
      { file: "INTRODUCCION MARKTING Y VENTAS.mp4", title: "Introducción a marketing y ventas" },
      { file: "1.01 DIFERENCIAS MARKETING Y VENTAS.mp4", title: "Diferencias entre marketing y ventas" },
      { file: "1.02 MOTIVACION INFORMADA_.mp4", title: "Motivación informada" },
      { file: "1.03 CRITERIOS Y FUNDAMENTOS.mp4", title: "Criterios y fundamentos" },
      { file: "1.04 EMBUDO DE VENTAS.mp4", title: "Embudo de ventas" },
      { file: "1.05 COMUNICACION.mp4", title: "Comunicación" },
      { file: "1.06 NIVELES DE CONCIENCIA.mp4", title: "Niveles de conciencia" },
      { file: "1.07 CONSIDERADOS.mp4", title: "Clientes considerados" },
      { file: "1.08 SEGUIMIENTO.mp4", title: "Seguimiento" },
      { file: "1.09 VELOCIDAD DE RESPUESTA.mp4", title: "Velocidad de respuesta" },
      { file: "1.10 CONCLUSION.mp4", title: "Conclusión" },
    ],
  },
];

async function ensureCourse(entry: CourseEntry, order: number) {
  const existing = await Course.findOne({ slug: entry.slug });
  if (existing) return existing;
  const course = await Course.create({
    title: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    description: entry.summary,
    status: "published",
    order,
    publishedAt: new Date(),
  });
  console.log(`📚 Curso creado: ${course.title}`);
  return course;
}

async function main() {
  const baseDir = process.argv[2] || path.join(process.env.HOME || "", "Downloads");

  const missing = COURSES.flatMap((course) =>
    course.lessons
      .map((lesson) => path.join(baseDir, course.folder, lesson.file))
      .filter((file) => !fs.existsSync(file)),
  );
  if (missing.length) {
    console.error("❌ No encuentro estos archivos:\n" + missing.join("\n"));
    process.exit(1);
  }

  await dbConnect();
  const lastCourse = await Course.findOne().sort({ order: -1 });
  let nextOrder = (lastCourse?.order ?? -1) + 1;

  for (const entry of COURSES) {
    const course = await ensureCourse(entry, nextOrder++);
    console.log(`\n=== ${course.title}`);

    for (const [order, lesson] of entry.lessons.entries()) {
      const slug = slugify(lesson.title);
      if (await Lesson.exists({ course: course._id, slug })) {
        console.log(`⏭️  ${lesson.title} (ya estaba)`);
        continue;
      }

      console.log(`🎬 [${order + 1}/${entry.lessons.length}] ${lesson.title}`);
      try {
        const video = await uploadVideo(
          path.join(baseDir, entry.folder, lesson.file),
          `${lesson.title} - ${course.title}`,
        );
        await Lesson.create({
          course: course._id,
          title: lesson.title,
          slug,
          summary: lesson.title,
          status: "published",
          order,
          durationSeconds: video.duration,
          video,
          publishedAt: new Date(),
        });
        console.log("   ✅ publicada");
      } catch (error) {
        console.error(`   ❌ ${(error as Error).message} (vuelve a correr el script para reintentar)`);
      }
    }
  }

  console.log("\n🎉 Carga terminada");
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
