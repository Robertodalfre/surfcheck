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
} from '../domain/scheduling.model.js';
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
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const scheduling = await getSchedulingById(req.params.id);
    
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

    res.json({ scheduling });
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
router.post('/', requireAuth, async (req, res) => {
  try {
    const { spot_id, preferences = {}, notifications = {}, active = true } = req.body;

    // Validações
    if (!spot_id) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: 'ID do pico é obrigatório' 
      });
    }

    // Verificar se o pico existe
    const spot = getSpotById(spot_id);
    if (!spot) {
      return res.status(400).json({ 
        error: 'validation_error', 
        message: `Pico '${spot_id}' não encontrado` 
      });
    }

    // Criar agendamento
    const schedulingData = {
      uid: req.user.uid,
      spot_id,
      preferences,
      notifications,
      active
    };

    const scheduling = await createScheduling(schedulingData);

    logger.info({ 
      scheduling_id: scheduling.id, 
      uid: req.user.uid,
      spot_id 
    }, 'scheduling created');

    res.status(201).json({ 
      scheduling,
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
 * Atualiza um agendamento
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const schedulingId = req.params.id;
    const updates = req.body;

    // Buscar agendamento atual
    const currentScheduling = await getSchedulingById(schedulingId);
    if (!currentScheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verificar se pertence ao usuário
    if (currentScheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    // Atualizar
    const updatedScheduling = await updateScheduling(schedulingId, updates);

    logger.info({ 
      scheduling_id: schedulingId,
      uid: req.user.uid,
      updates: Object.keys(updates)
    }, 'scheduling updated');

    res.json({ 
      scheduling: updatedScheduling,
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
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const schedulingId = req.params.id;

    // Buscar agendamento atual
    const scheduling = await getSchedulingById(schedulingId);
    if (!scheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verificar se pertence ao usuário
    if (scheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    // Remover
    await deleteScheduling(schedulingId);

    logger.info({ 
      scheduling_id: schedulingId,
      uid: req.user.uid 
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
 * POST /api/scheduling/:id/toggle
 * Ativa/desativa um agendamento
 */
router.post('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const schedulingId = req.params.id;

    // Buscar agendamento atual
    const scheduling = await getSchedulingById(schedulingId);
    if (!scheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verificar se pertence ao usuário
    if (scheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    // Alternar status
    const updatedScheduling = await updateScheduling(schedulingId, { 
      active: !scheduling.active 
    });

    logger.info({ 
      scheduling_id: schedulingId,
      uid: req.user.uid,
      new_status: updatedScheduling.active
    }, 'scheduling toggled');

    res.json({ 
      scheduling: updatedScheduling,
      message: `Agendamento ${updatedScheduling.active ? 'ativado' : 'pausado'} com sucesso` 
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error toggling scheduling');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/scheduling/:id/preview
 * Gera preview das próximas janelas para um agendamento
 */
router.get('/:id/preview', requireAuth, async (req, res) => {
  try {
    const schedulingId = req.params.id;

    // Buscar agendamento
    const scheduling = await getSchedulingById(schedulingId);
    if (!scheduling) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'Agendamento não encontrado' 
      });
    }

    // Verificar se pertence ao usuário
    if (scheduling.uid !== req.user.uid) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: 'Acesso negado' 
      });
    }

    logger.info({ 
      scheduling_id: schedulingId,
      spot_id: scheduling.spot_id,
      uid: req.user.uid 
    }, 'analyzing windows for scheduling');

    // Analisar janelas
    const analysis = await analyzeWindows(scheduling);

    logger.info({ 
      scheduling_id: schedulingId,
      status: analysis.status,
      windows_found: analysis.windows?.length || 0,
      good_windows: analysis.next_good_windows?.length || 0
    }, 'window analysis completed');

    res.json(analysis);
  } catch (error) {
    logger.error({ 
      error: error.message, 
      scheduling_id: req.params.id 
    }, 'error analyzing windows');
    
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message,
      status: 'error'
    });
  }
});

/**
 * GET /api/scheduling/validation/time-windows
 * Valida janelas de tempo
 */
router.get('/validation/time-windows', (req, res) => {
  const { windows } = req.query;
  const timeWindows = Array.isArray(windows) ? windows : [windows].filter(Boolean);
  
  const validWindows = validateTimeWindows(timeWindows);
  
  res.json({
    valid: validWindows.length === timeWindows.length,
    valid_windows: validWindows,
    invalid_windows: timeWindows.filter(w => !validWindows.includes(w))
  });
});

/**
 * GET /api/scheduling/validation/surf-style
 * Valida estilo de surf
 */
router.get('/validation/surf-style', (req, res) => {
  const { style } = req.query;
  const styles = Array.isArray(style) ? style : [style].filter(Boolean);
  
  const validStyles = validateSurfStyle(styles);
  
  res.json({
    valid: validStyles.length === styles.length,
    valid_styles: validStyles,
    invalid_styles: styles.filter(s => !validStyles.includes(s))
  });
});

/**
 * GET /api/scheduling/validation/wind-preference
 * Valida preferência de vento
 */
router.get('/validation/wind-preference', (req, res) => {
  const { preference } = req.query;
  const preferences = Array.isArray(preference) ? preference : [preference].filter(Boolean);
  
  const validPreferences = validateWindPreference(preferences);
  
  res.json({
    valid: validPreferences.length === preferences.length,
    valid_preferences: validPreferences,
    invalid_preferences: preferences.filter(p => !validPreferences.includes(p))
  });
});

export default router;
