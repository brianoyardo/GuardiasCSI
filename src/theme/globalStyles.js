import { createGlobalStyle } from 'styled-components'

/**
 * SentinelOps — Global Styles (Styled Components)
 * Additional global styles that benefit from theme access
 */
const GlobalStyles = createGlobalStyle`
  /* Styled-components global overrides that need theme values */
  
  #root {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Toast / notification container */
  .sentinel-toast-container {
    position: fixed;
    top: ${({ theme }) => theme.spacing[4]};
    right: ${({ theme }) => theme.spacing[4]};
    z-index: ${({ theme }) => theme.zIndex.toast};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing[2]};
  }

  /* Overlay backdrop */
  .sentinel-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: ${({ theme }) => theme.zIndex.overlay};
    animation: fadeIn 200ms ease forwards;
  }

  /* Status dot indicator */
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    
    &--active {
      background: ${({ theme }) => theme.colors.accent[500]};
      box-shadow: 0 0 8px ${({ theme }) => theme.colors.accent[500]};
    }
    
    &--warning {
      background: ${({ theme }) => theme.colors.warning[500]};
      box-shadow: 0 0 8px ${({ theme }) => theme.colors.warning[500]};
    }
    
    &--danger {
      background: ${({ theme }) => theme.colors.danger[500]};
      box-shadow: 0 0 8px ${({ theme }) => theme.colors.danger[500]};
    }
    
    &--inactive {
      background: ${({ theme }) => theme.colors.surface[500]};
    }
  }
`

export default GlobalStyles
