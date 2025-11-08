import { Router } from 'express';
import {
  createScheduling,
  getSchedulingsByUser,
  getSchedulingById,
  updateScheduling,
  deleteScheduling,
  validateTimeWindows,
  validateSurfStyle,
  validateWindPreference
} from '../domain/scheduling.model.firestore.js';
import { getSpotById } from '../domain/spots.model.js';
import { analyzeWindows } from '../services/window-analysis.service.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Middleware para validar autenticação (simulado por enquanto)
 * Em produção, usar Firebase Admin SDK para validar o token
 */
function requireAuth(req, res, next) {
  // Por enquanto, simula usuário autenticado via header
  const uid = req.headers['x-user-id'] || req.query.uid;
  
  if (!uid) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      message: 'UID do usuário é obrigatório' 
    });
  }
  
  req.user = { uid };
  next();
}

/**
 * GET /api/scheduling
 * Lista todos os agendamentos do usuário autenticado
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const schedulings = await getSchedulingsByUser(req.user.uid);

    logger.info({ uid: req.user.uid, count: schedulings.length }, 'schedulings listed');
    
    res.json({ 
      schedulings,
      total: schedulings.length 
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error listing schedulings');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/scheduling/:id
 * Busca um agendamento específico
 */
router.get('/:id', requireAuth, (req, res) => {
  try {
    const scheduling = getSchedulingById(req.params.id);
    
    if (!scheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verifica se o agendamento pertence ao usuário
    if (scheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    // Enriquecer com dados do pico
    const enrichedScheduling = {
      ...scheduling,
      spot: getSpotById(scheduling.spot_id)
    };

    res.json({ scheduling: enrichedScheduling });
  } catch (error) {
    logger.error({ error: error.message }, 'error getting scheduling');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/scheduling
 * Cria um novo agendamento
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { spot_id, preferences = {}, notifications = {}, active = true } = req.body;

    // Validações
    if (!spot_id) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'ID do pico é obrigatório' 
      });
    }

    // Valida se o pico existe
    const spot = getSpotById(spot_id);
    if (!spot) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Pico não encontrado' 
      });
    }

    // Validações de preferências
    if (preferences.time_windows && !validateTimeWindows(preferences.time_windows)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Janelas de tempo inválidas. Use: morning, midday, afternoon, evening' 
      });
    }

    if (preferences.surf_style && !validateSurfStyle(preferences.surf_style)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Estilo de surf inválido. Use: longboard, shortboard, any' 
      });
    }

    if (preferences.wind_preference && !validateWindPreference(preferences.wind_preference)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Preferência de vento inválida. Use: offshore, light, any' 
      });
    }

    if (preferences.min_score && (preferences.min_score < 0 || preferences.min_score > 100)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Score mínimo deve estar entre 0 e 100' 
      });
    }

    if (preferences.days_ahead && ![1, 3, 5].includes(preferences.days_ahead)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Dias à frente deve ser 1, 3 ou 5' 
      });
    }

    // Cria o agendamento
    const scheduling = createScheduling({
      uid: req.user.uid,
      spot_id,
      preferences,
      notifications,
      active
    });

    // Enriquecer com dados do pico
    const enrichedScheduling = {
      ...scheduling,
      spot: getSpotById(scheduling.spot_id)
    };

    logger.info({ 
      uid: req.user.uid, 
      scheduling_id: scheduling.id, 
      spot_id 
    }, 'scheduling created');

    res.status(201).json({ 
      scheduling: enrichedScheduling,
      message: 'Agendamento criado com sucesso' 
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error creating scheduling');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * PUT /api/scheduling/:id
 * Atualiza um agendamento existente
 */
router.put('/:id', requireAuth, (req, res) => {
  try {
    const scheduling = getSchedulingById(req.params.id);
    
    if (!scheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verifica se o agendamento pertence ao usuário
    if (scheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    const { preferences, notifications, active } = req.body;

    // Validações similares ao POST
    if (preferences?.time_windows && !validateTimeWindows(preferences.time_windows)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Janelas de tempo inválidas' 
      });
    }

    if (preferences?.surf_style && !validateSurfStyle(preferences.surf_style)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Estilo de surf inválido' 
      });
    }

    if (preferences?.wind_preference && !validateWindPreference(preferences.wind_preference)) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'Preferência de vento inválida' 
      });
    }

    // Atualiza o agendamento
    const updatedScheduling = updateScheduling(req.params.id, {
      preferences: preferences ? { ...scheduling.preferences, ...preferences } : scheduling.preferences,
      notifications: notifications ? { ...scheduling.notifications, ...notifications } : scheduling.notifications,
      active: active !== undefined ? active : scheduling.active
    });

    // Enriquecer com dados do pico
    const enrichedScheduling = {
      ...updatedScheduling,
      spot: getSpotById(updatedScheduling.spot_id)
    };

    logger.info({ 
      uid: req.user.uid, 
      scheduling_id: req.params.id 
    }, 'scheduling updated');

    res.json({ 
      scheduling: enrichedScheduling,
      message: 'Agendamento atualizado com sucesso' 
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error updating scheduling');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/scheduling/:id
 * Remove um agendamento
 */
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const scheduling = getSchedulingById(req.params.id);
    
    if (!scheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verifica se o agendamento pertence ao usuário
    if (scheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    const deleted = deleteScheduling(req.params.id);
    
    if (!deleted) {
      return res.status(500).json({ 
        error: 'internal_error', 
        message: 'Erro ao remover agendamento' 
      });
    }

    logger.info({ 
      uid: req.user.uid, 
      scheduling_id: req.params.id 
    }, 'scheduling deleted');

    res.json({ 
      message: 'Agendamento removido com sucesso' 
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error deleting scheduling');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/scheduling/:id/preview
 * Preview das próximas janelas baseado nas preferências do agendamento
 */
router.get('/:id/preview', requireAuth, async (req, res) => {
  try {
    const scheduling = getSchedulingById(req.params.id);
    
    if (!scheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verifica se o agendamento pertence ao usuário
    if (scheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    // Analisar janelas baseado nas preferências
    const analysis = await analyzeWindows(scheduling);

    logger.info({ 
      scheduling_id: scheduling.id,
      windows_found: analysis.windows.length,
      status: analysis.status
    }, 'window analysis completed');

    res.json({ 
      preview: analysis,
      cache: { fresh: false } // Sempre fresh para análise personalizada
    });
  } catch (error) {
    logger.error({ 
      error: error.message, 
      scheduling_id: req.params.id 
    }, 'error getting preview');
    
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

export default router;
