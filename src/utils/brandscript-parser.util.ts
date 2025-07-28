/**
 * Utilidad para parsear BrandScripts en secciones estructuradas
 * Basado en el framework StoryBrand de 7 secciones
 */

export interface BrandScriptSections {
  character: {
    title: string;
    number: string;
    content: {
      whatTheyWant: string;
      external: string;
      internal: string;
      philosophical: string;
    };
  };
  problem: {
    title: string;
    number: string;
    content: {
      external: string;
      internal: string;
      philosophical: string;
    };
  };
  guide: {
    title: string;
    number: string;
    content: {
      empathy: string;
      competencyAndAuthority: string;
    };
  };
  plan: {
    title: string;
    number: string;
    content: {
      processSteps: string[];
    };
  };
  callToAction: {
    title: string;
    number: string;
    content: {
      direct: string;
      transitional: string;
    };
  };
  success: {
    title: string;
    number: string;
    content: {
      successfulResults: string;
    };
  };
  failure: {
    title: string;
    number: string;
    content: {
      tragicResults: string;
    };
  };
  transformation: {
    title: string;
    number: string;
    content: {
      from: string;
      to: string;
    };
  };
}

/**
 * Función principal para parsear el BrandScript en secciones estructuradas
 * @param generatedScript - El script generado por IA
 * @returns Objeto con las 7 secciones del framework StoryBrand
 */
export function parseBrandScriptSections(generatedScript: string): BrandScriptSections {
  const sections: BrandScriptSections = {
    character: {
      title: "A Character",
      number: "01",
      content: {
        whatTheyWant: "",
        external: "",
        internal: "",
        philosophical: ""
      }
    },
    problem: {
      title: "With a Problem",
      number: "02",
      content: {
        external: "",
        internal: "",
        philosophical: ""
      }
    },
    guide: {
      title: "Meets a Guide",
      number: "03",
      content: {
        empathy: "",
        competencyAndAuthority: ""
      }
    },
    plan: {
      title: "Who Gives Them A Plan",
      number: "04",
      content: {
        processSteps: [] as string[]
      }
    },
    callToAction: {
      title: "And Calls Them to Action",
      number: "05",
      content: {
        direct: "",
        transitional: ""
      }
    },
    success: {
      title: "Success",
      number: "06A",
      content: {
        successfulResults: ""
      }
    },
    failure: {
      title: "Failure",
      number: "06B",
      content: {
        tragicResults: ""
      }
    },
    transformation: {
      title: "Identity Transformation",
      number: "07",
      content: {
        from: "",
        to: ""
      }
    }
  };

  // Parsear el contenido usando expresiones regulares
  try {
    // 1. Character (El Personaje)
    const characterMatch = generatedScript.match(/(?:1\.|\*\*1\.|EL PERSONAJE|A CHARACTER)[\s\S]*?(?=(?:2\.|\*\*2\.|CON UN PROBLEMA|WITH A PROBLEM)|$)/i);
    if (characterMatch) {
      const characterText = characterMatch[0];
      sections.character.content.whatTheyWant = extractContent(characterText, /(?:qué quieren|what they want|deseo|want)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
      sections.character.content.external = extractContent(characterText, /(?:externo|external)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
      sections.character.content.internal = extractContent(characterText, /(?:interno|internal)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
      sections.character.content.philosophical = extractContent(characterText, /(?:filosófico|philosophical)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
    }

    // 2. Problem (Con un Problema)
    const problemMatch = generatedScript.match(/(?:2\.|\*\*2\.|CON UN PROBLEMA|WITH A PROBLEM)[\s\S]*?(?=(?:3\.|\*\*3\.|SE ENCUENTRA CON UN GUÍA|MEETS A GUIDE)|$)/i);
    if (problemMatch) {
      const problemText = problemMatch[0];
      sections.problem.content.external = extractContent(problemText, /(?:externo|external)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
      sections.problem.content.internal = extractContent(problemText, /(?:interno|internal)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
      sections.problem.content.philosophical = extractContent(problemText, /(?:filosófico|philosophical)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
    }

    // 3. Guide (Se encuentra con un Guía)
    const guideMatch = generatedScript.match(/(?:3\.|\*\*3\.|SE ENCUENTRA CON UN GUÍA|MEETS A GUIDE)[\s\S]*?(?=(?:4\.|\*\*4\.|QUE LE DA UN PLAN|WHO GIVES THEM A PLAN)|$)/i);
    if (guideMatch) {
      const guideText = guideMatch[0];
      sections.guide.content.empathy = extractContent(guideText, /(?:empatía|empathy)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
      sections.guide.content.competencyAndAuthority = extractContent(guideText, /(?:competencia|autoridad|competency|authority)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
    }

    // 4. Plan (Que le da un Plan)
    const planMatch = generatedScript.match(/(?:4\.|\*\*4\.|QUE LE DA UN PLAN|WHO GIVES THEM A PLAN)[\s\S]*?(?=(?:5\.|\*\*5\.|Y LO LLAMA A LA ACCIÓN|AND CALLS THEM TO ACTION)|$)/i);
    if (planMatch) {
      const planText = planMatch[0];
      const steps = extractSteps(planText);
      sections.plan.content.processSteps = steps;
    }

    // 5. Call to Action (Y lo llama a la Acción)
    const ctaMatch = generatedScript.match(/(?:5\.|\*\*5\.|Y LO LLAMA A LA ACCIÓN|AND CALLS THEM TO ACTION)[\s\S]*?(?=(?:6\.|\*\*6\.|ÉXITO|SUCCESS)|$)/i);
    if (ctaMatch) {
      const ctaText = ctaMatch[0];
      sections.callToAction.content.direct = extractContent(ctaText, /(?:directo|direct)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
      sections.callToAction.content.transitional = extractContent(ctaText, /(?:transicional|transitional)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
    }

    // 6A. Success (Éxito)
    const successMatch = generatedScript.match(/(?:6\.|\*\*6\.|ÉXITO|SUCCESS)[\s\S]*?(?=(?:7\.|\*\*7\.|FRACASO|FAILURE|TRANSFORMACIÓN|TRANSFORMATION)|$)/i);
    if (successMatch) {
      const successText = successMatch[0];
      sections.success.content.successfulResults = extractContent(successText, /(?:resultados exitosos|successful results|éxito|success)[\s\S]*?(?=\n\n|\*\*|$)/i) || successText.replace(/(?:6\.|\*\*6\.|ÉXITO|SUCCESS)[\s\S]*?:/i, '').trim();
    }

    // 6B. Failure (Fracaso)
    const failureMatch = generatedScript.match(/(?:FRACASO|FAILURE)[\s\S]*?(?=(?:7\.|\*\*7\.|TRANSFORMACIÓN|TRANSFORMATION)|$)/i);
    if (failureMatch) {
      const failureText = failureMatch[0];
      sections.failure.content.tragicResults = extractContent(failureText, /(?:resultados trágicos|tragic results|fracaso|failure)[\s\S]*?(?=\n\n|\*\*|$)/i) || failureText.replace(/(?:FRACASO|FAILURE)[\s\S]*?:/i, '').trim();
    }

    // 7. Transformation (Transformación)
    const transformationMatch = generatedScript.match(/(?:7\.|\*\*7\.|TRANSFORMACIÓN|TRANSFORMATION)[\s\S]*?$/i);
    if (transformationMatch) {
      const transformationText = transformationMatch[0];
      sections.transformation.content.from = extractContent(transformationText, /(?:de|from)[\s\S]*?(?=(?:a|to)|\n\n|\*\*|$)/i) || "";
      sections.transformation.content.to = extractContent(transformationText, /(?:a|to)[\s\S]*?(?=\n\n|\*\*|$)/i) || "";
    }

  } catch (error) {
    console.error('Error parsing BrandScript sections:', error);
  }

  return sections;
}

/**
 * Función auxiliar para extraer contenido usando expresiones regulares
 * @param text - Texto del cual extraer contenido
 * @param regex - Expresión regular para la extracción
 * @returns Contenido extraído y limpio
 */
export function extractContent(text: string, regex: RegExp): string {
  const match = text.match(regex);
  if (match) {
    return match[0].replace(regex.source.split('[')[0], '').trim();
  }
  return "";
}

/**
 * Función auxiliar para extraer pasos del plan
 * @param text - Texto del cual extraer los pasos
 * @returns Array de pasos del plan (máximo 3)
 */
export function extractSteps(text: string): string[] {
  const steps: string[] = [];
  const stepMatches = text.match(/(?:paso|step)\s*\d+[\s\S]*?(?=(?:paso|step)\s*\d+|$)/gi);
  
  if (stepMatches) {
    stepMatches.forEach(step => {
      const cleanStep = step.replace(/(?:paso|step)\s*\d+[:\s]*/i, '').trim();
      if (cleanStep) {
        steps.push(cleanStep);
      }
    });
  } else {
    // Si no encuentra pasos numerados, buscar líneas que empiecen con números o guiones
    const lineSteps = text.match(/(?:^|\n)\s*(?:\d+\.|[-•])\s*[^\n]+/gm);
    if (lineSteps) {
      lineSteps.forEach(step => {
        const cleanStep = step.replace(/^\s*(?:\d+\.|[-•])\s*/, '').trim();
        if (cleanStep && cleanStep.length > 10) {
          steps.push(cleanStep);
        }
      });
    }
  }
  
  return steps.slice(0, 3); // Máximo 3 pasos
}

/**
 * Función para validar que las secciones parseadas contienen información válida
 * @param sections - Secciones parseadas del BrandScript
 * @returns true si las secciones son válidas
 */
export function validateParsedSections(sections: BrandScriptSections): boolean {
  // Verificar que al menos las secciones principales tengan contenido
  const hasCharacterContent = sections.character.content.whatTheyWant.length > 0;
  const hasProblemContent = sections.problem.content.external.length > 0 || sections.problem.content.internal.length > 0;
  const hasGuideContent = sections.guide.content.empathy.length > 0 || sections.guide.content.competencyAndAuthority.length > 0;
  const hasPlanContent = sections.plan.content.processSteps.length > 0;
  
  return hasCharacterContent && hasProblemContent && hasGuideContent && hasPlanContent;
}

/**
 * Función para obtener un resumen de las secciones parseadas
 * @param sections - Secciones parseadas del BrandScript
 * @returns Objeto con estadísticas de las secciones
 */
export function getSectionsSummary(sections: BrandScriptSections) {
  return {
    totalSections: 7,
    sectionsWithContent: [
      sections.character.content.whatTheyWant.length > 0,
      sections.problem.content.external.length > 0 || sections.problem.content.internal.length > 0,
      sections.guide.content.empathy.length > 0 || sections.guide.content.competencyAndAuthority.length > 0,
      sections.plan.content.processSteps.length > 0,
      sections.callToAction.content.direct.length > 0 || sections.callToAction.content.transitional.length > 0,
      sections.success.content.successfulResults.length > 0,
      sections.failure.content.tragicResults.length > 0,
      sections.transformation.content.from.length > 0 || sections.transformation.content.to.length > 0
    ].filter(Boolean).length,
    planSteps: sections.plan.content.processSteps.length,
    isComplete: validateParsedSections(sections)
  };
}