// Aulas de cada curso, usadas na área "Meus cursos".
//
// Para publicar as aulas de um curso, cadastre os módulos dele em CURRICULUM com o id do curso.
// `video` aceita o link de incorporação do YouTube/Vimeo/Panda (https://www.youtube.com/embed/ID)
// ou o endereço de um arquivo .mp4. Aula sem vídeo aparece como "Vídeo em breve".
//
// Exemplo:
// 'c-fundamentos': [
//   {
//     title: 'Postura neutra e alinhamento articular',
//     lessons: [
//       { title: 'Boas-vindas ao curso', duration: '04:12', video: 'https://www.youtube.com/embed/ID_DO_VIDEO' },
//       { title: 'O que é postura neutra', duration: '09:30', video: '' },
//     ],
//   },
// ],
export const CURRICULUM = {}

/*
  Curso ainda sem aulas cadastradas: monta a grade a partir dos módulos e do total
  de aulas de conteudo.js, dividindo as aulas entre os módulos.
*/
function placeholderCurriculum(course) {
  const total = course.lessons
  const modules = course.modules
  const base = Math.floor(total / modules.length)
  const extra = total % modules.length
  let n = 0

  return modules.map((title, m) => ({
    title,
    lessons: Array.from({ length: base + (m < extra ? 1 : 0) }, () => {
      n += 1
      return { title: `Aula ${String(n).padStart(2, '0')}`, duration: '', video: '' }
    }),
  }))
}

// Módulos com ids estáveis por aula (usados para salvar o progresso)
export function getCurriculum(course) {
  const modules = CURRICULUM[course.id] ?? placeholderCurriculum(course)
  return modules.map((mod, m) => ({
    ...mod,
    id: `m${m + 1}`,
    lessons: mod.lessons.map((lesson, l) => ({ ...lesson, id: `${course.id}:m${m + 1}a${l + 1}` })),
  }))
}

export const flatLessons = (curriculum) => curriculum.flatMap((mod) => mod.lessons.map((l) => ({ ...l, module: mod })))
