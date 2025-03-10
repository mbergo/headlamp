import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import _ from 'lodash';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { apply } from '../../../lib/k8s/apiProxy';
import Deployment from '../../../lib/k8s/deployment';
import { KubeObject } from '../../../lib/k8s/KubeObject';
import ReplicaSet from '../../../lib/k8s/replicaSet';
import StatefulSet from '../../../lib/k8s/statefulSet';
import { clusterAction } from '../../../redux/clusterActionSlice';
import {
  EventStatus,
  HeadlampEventType,
  useEventCallback,
} from '../../../redux/headlampEventSlice';
import { AppDispatch } from '../../../redux/stores/store';
import ActionButton, { ButtonStyle } from '../ActionButton';
import AuthVisible from './AuthVisible';

interface RestartButtonProps {
  item: Deployment | StatefulSet | ReplicaSet;
  buttonStyle?: ButtonStyle;
}

export function RestartButton(props: RestartButtonProps) {
  const { item, buttonStyle } = props;
  const { t } = useTranslation();
  const [openDialog, setOpenDialog] = useState(false);
  const dispatch: AppDispatch = useDispatch();

  function applyFunc() {
    try {
      const clonedItem = _.cloneDeep(item);
      clonedItem.spec.template.metadata.annotations = {
        ...clonedItem.spec.template.metadata.annotations,
        'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
      };
      apply(clonedItem.jsonData);
    } catch (err) {
      console.error('Error while restarting resource:', err);
    }
  }

  function handleClose() {
    setOpenDialog(false);
  }

  function handleSave() {
    const cancelUrl = location.pathname;
    const itemName = item.metadata.name;

    setOpenDialog(false);

    // setOpenDialog(false);
    dispatch(
      clusterAction(() => applyFunc(), {
        startMessage: t('Restarting {{ itemName }}…', { itemName }),
        cancelledMessage: t('Cancelled restarting {{ itemName }}.', { itemName }),
        successMessage: t('Restarted {{ itemName }}.', { itemName }),
        errorMessage: t('Failed to restart {{ itemName }}.', { itemName }),
        cancelUrl,
        errorUrl: cancelUrl,
      })
    );
  }

  if (!item || !['Deployment', 'StatefulSet', 'DaemonSet'].includes(item.kind)) {
    return null;
  }

  return (
    <AuthVisible
      item={item}
      authVerb="update"
      onError={(err: Error) => {
        console.error(`Error while getting authorization for restart button in ${item}:`, err);
      }}
    >
      <ActionButton
        description={t('translation|Restart')}
        buttonStyle={buttonStyle}
        onClick={() => {
          setOpenDialog(true);
        }}
        icon="mdi:restart"
      />
      <RestartDialog resource={item} open={openDialog} onClose={handleClose} onSave={handleSave} />
    </AuthVisible>
  );
}

interface RestartDialogProps {
  resource: KubeObject;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

function RestartDialog(props: RestartDialogProps) {
  const { resource, open, onClose, onSave } = props;
  const { t } = useTranslation();
  const dispatchRestartEvent = useEventCallback(HeadlampEventType.RESTART_RESOURCE);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="form-dialog-title"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="form-dialog-title">{t('translation|Restart')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('translation|Are you sure you want to restart {{ name }}?', {
            name: resource.metadata.name,
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t('translation|Cancel')}
        </Button>
        <Button
          onClick={() => {
            dispatchRestartEvent({
              resource: resource,
              status: EventStatus.CONFIRMED,
            });
            onSave();
          }}
          color="primary"
        >
          {t('translation|Restart')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
