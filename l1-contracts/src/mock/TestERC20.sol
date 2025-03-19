// SPDX-License-Identifier: Apache-2.0
// docs:start:contract
pragma solidity >=0.8.27;

import {Ownable} from "@oz/access/Ownable.sol";
import {ERC20} from "@oz/token/ERC20/ERC20.sol";
import {IMintableERC20} from "./../governance/interfaces/IMintableERC20.sol";

contract TestERC20 is ERC20, IMintableERC20, Ownable {
  mapping(address => bool) public minters;

  modifier onlyMinter() {
    require(minters[msg.sender], "Not authorized to mint");
    _;
  }

  constructor(string memory _name, string memory _symbol, address _owner)
    ERC20(_name, _symbol)
    Ownable(_owner)
  {
    minters[_owner] = true;
  }

  function addMinter(address _minter) external override(IMintableERC20) onlyMinter {
    require(_minter != address(0), "Invalid address");
    minters[_minter] = true;
  }

  function removeMinter(address _minter) external override(IMintableERC20) onlyMinter {
    require(_minter != owner(), "Cannot remove owner as minter");
    minters[_minter] = false;
  }

  function mint(address _to, uint256 _amount) external override(IMintableERC20) onlyMinter {
    _mint(_to, _amount);
  }

  function transferOwnership(address newOwner) public override(Ownable) onlyOwner {
    if (newOwner == address(0)) {
      revert OwnableInvalidOwner(address(0));
    }
    minters[owner()] = false;
    _transferOwnership(newOwner);
    minters[newOwner] = true;
  }
}
// docs:end:contract
