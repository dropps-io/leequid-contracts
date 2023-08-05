import "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7DigitalAssetInitAbstract.sol";
import "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/ILSP7DigitalAsset.sol";

contract SwapV1Mock is LSP7DigitalAssetInitAbstract {
    ILSP7DigitalAsset token;                // address of the LSP7 token traded on this contract

    function setup(address token_addr) public initializer {
        token = ILSP7DigitalAsset(token_addr);
    }

    function addLiquidity(uint256 amount) public {
        token.transfer(msg.sender, address(this), amount, true, "");
        _mint(msg.sender, amount, true, "");
    }

    function removeLiquidity(uint256 amount) public {
        token.transfer(address(this), msg.sender, amount, true, "");
        _burn(msg.sender, amount, "");
    }
}