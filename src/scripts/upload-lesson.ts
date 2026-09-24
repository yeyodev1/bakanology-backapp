import "dotenv/config";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import mongoose from "mongoose";
import { dbConnect } from "../config/mongo";
import { Course } from "../models/Course";
import { Lesson } from "../models/Lesson";

// Uso:
// pnpm ts-node src/scripts/upload-lesson.ts <archivo.mp4> <curso-slug> "<Título del curso>" "<Título de la clase>" <orden>
// Crea el curso si no existe y sube el video a Bunny Stream como una lección publicada.

const BUNNY_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function bunny<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}${endpoint}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        AccessKey: BUNNY_API_KEY!,
        ...init.headers,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Bunny API ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function uploadVideo(filePath: string, title: string) {
  const size = fs.statSync(filePath).size;
  const { guid } = await bunny<{ guid: string }>("/videos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  console.log(`📝 Video creado en Bunny: ${guid}`);
  console.log(`📤 Subiendo ${(size / 1024 / 1024).toFixed(0)} MB...`);

  const upload = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${guid}`,
    {
      method: "PUT",
      headers: {
        AccessKey: BUNNY_API_KEY!,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(size),
      },
      body: Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream,
      duplex: "half",
    } as RequestInit,
  );
  if (!upload.ok) {
    throw new Error(`Upload failed: ${upload.status} ${await upload.text()}`);
  }

  console.log("⏳ Esperando que Bunny procese el video...");
  for (let attempt = 0; attempt < 360; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const info = await bunny<{
      status: number;
      encodeProgress: number;
      length: number;
      storageSize: number;
      width: number;
      height: number;
      dateUploaded: string;
    }>(`/videos/${guid}`);
    if (attempt % 6 === 0) {
      console.log(`   ${info.encodeProgress}% (status ${info.status})`);
    }
    if (info.status === 4) {
      return {
        provider: "bunny" as const,
        publicId: guid,
        resourceType: "video" as const,
        format: "m3u8",
        bytes: info.storageSize || size,
        width: info.width || undefined,
        height: info.height || undefined,
        duration: info.length || 0,
        originalFilename: path.basename(filePath),
        createdAt: info.dateUploaded,
      };
    }
    if (info.status === 5 || info.status === 6) {
      throw new Error("Bunny no pudo procesar el video");
    }
  }
  throw new Error("Tiempo de procesamiento agotado");
}

async function main() {
  const [filePath, courseSlug, courseTitle, lessonTitle, orderArg] =
    process.argv.slice(2);
  if (!filePath || !courseSlug || !courseTitle || !lessonTitle) {
    console.error(
      'Uso: pnpm ts-node src/scripts/upload-lesson.ts <archivo> <curso-slug> "<Curso>" "<Clase>" [orden]',
    );
    process.exit(1);
  }
  if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
    throw new Error("BUNNY_STREAM_API_KEY y BUNNY_STREAM_LIBRARY_ID son requeridos");
  }

  await dbConnect();

  let course = await Course.findOne({ slug: courseSlug });
  if (!course) {
    const lastCourse = await Course.findOne().sort({ order: -1 });
    course = await Course.create({
      title: courseTitle,
      slug: courseSlug,
      summary: courseTitle,
      status: "published",
      order: (lastCourse?.order ?? -1) + 1,
      publishedAt: new Date(),
    });
    console.log(`📚 Curso creado: ${course.title} (${course._id})`);
  }

  const lessonSlug = slugify(lessonTitle);
  const existing = await Lesson.findOne({ course: course._id, slug: lessonSlug });
  if (existing) {
    console.log(`✅ La clase ya existe: ${existing._id}. Nada que hacer.`);
    process.exit(0);
  }

  const order = orderArg ? Number(orderArg) : await Lesson.countDocuments({ course: course._id });
  const video = await uploadVideo(filePath, `${lessonTitle} - ${course.title}`);
  const lesson = await Lesson.create({
    course: course._id,
    title: lessonTitle,
    slug: lessonSlug,
    summary: lessonTitle,
    status: "published",
    order,
    durationSeconds: video.duration,
    video,
    publishedAt: new Date(),
  });

  console.log(`🎉 Clase publicada: ${lesson.title} (${lesson._id})`);
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
